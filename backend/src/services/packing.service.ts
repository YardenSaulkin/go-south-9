import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ItemStatus,
  PackingUnitStatus,
  Prisma,
  type Destination,
  type OrgScope,
} from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import {
  assertCanAccessMador,
  assertCanCreatePackingUnit,
} from '../domain/permissions.js';
import {
  assertClaimSucceeded,
  assertItemTransition,
} from '../domain/status-transitions.js';
import { formatSerial, planQuantitySplit } from '../domain/quantities.js';
import {
  mappingStatusFromProvenance,
  type RoomMappingStatus,
} from '../domain/mapping.js';
import type { CreatePackingUnitInput } from '../domain/operations.schemas.js';
import type { DestinationSelection } from '../domain/destination.js';
import { db } from '../lib/db.js';

type DatabaseClient = Prisma.TransactionClient | typeof db;

export function eligibleItemsWhere(orgScopeId: string, sourceRoomId: string) {
  return {
    orgScopeId,
    sourceRoomId,
    packingUnitId: null,
    status: ItemStatus.not_sent,
    sourceMappingReportId: { not: '' },
  };
}

export interface SourceRoomDetails {
  id: string;
  description: string | null;
  mappingStatus: RoomMappingStatus;
  roomResponsible: string | null;
  orgCode: string | null;
}

export interface DestinationSnapshot {
  id: string | null;
  code: string;
  description: string;
  building: string;
  floor: string;
  room: string;
}

function serializeDestination(destination: Destination): string {
  return JSON.stringify({
    id: destination.id,
    code: destination.destinationCode,
    description: destination.description,
    building: destination.building,
    floor: destination.floor,
    room: destination.room,
  } satisfies DestinationSnapshot);
}

function parseDestination(value: string | null): DestinationSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DestinationSnapshot>;
    if (
      typeof parsed.description !== 'string' ||
      typeof parsed.building !== 'string' ||
      typeof parsed.floor !== 'string' ||
      typeof parsed.room !== 'string'
    ) {
      return null;
    }
    return {
      id: typeof parsed.id === 'string' ? parsed.id : null,
      code: typeof parsed.code === 'string' ? parsed.code : '',
      description: parsed.description,
      building: parsed.building,
      floor: parsed.floor,
      room: parsed.room,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class PackingService {
  private async getScope(user: CurrentUser, orgScopeId: string) {
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessMador(user.access, scope.mador, scope.orgCode?.trim().slice(0, 2));
    return scope;
  }

  private async resolveSourceRoom(
    client: DatabaseClient,
    scope: OrgScope,
    roomId: string,
  ): Promise<SourceRoomDetails> {
    const rows = await client.item.findMany({
      where: { orgScopeId: scope.id, sourceRoomId: roomId },
      select: {
        sourceDescription: true,
        sourceMappingReportId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) throw new NotFoundException('החדר לא קיים');

    const description = rows.find((row) => row.sourceDescription?.trim())
      ?.sourceDescription?.trim() ?? null;
    const mappedItemCount = rows.filter((row) =>
      Boolean(row.sourceMappingReportId?.trim()),
    ).length;

    return {
      id: roomId,
      description,
      mappingStatus: mappingStatusFromProvenance(roomId, mappedItemCount),
      roomResponsible: null,
      orgCode: scope.orgCode,
    };
  }

  private async resolveDestination(
    client: Prisma.TransactionClient,
    orgScopeId: string,
    actorUserId: string,
    selection: DestinationSelection,
  ): Promise<Destination> {
    if (selection.mode === 'existing') {
      const destination = await client.destination.findUnique({
        where: { id: selection.destinationId },
      });
      if (!destination || destination.orgScopeId !== orgScopeId) {
        throw new NotFoundException('היעד לא קיים במסגרת הארגונית שנבחרה');
      }
      return destination;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await client.destination.create({
          data: {
            destinationCode: `D-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
            description: selection.description,
            building: selection.building,
            floor: selection.floor,
            room: selection.room,
            orgScopeId,
            createdByUserId: actorUserId,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('לא ניתן להקצות מזהה יעד ייחודי');
  }

  async listSourceRooms(user: CurrentUser, orgScopeId: string) {
    const scope = await this.getScope(user, orgScopeId);
    const rows = await db.item.findMany({
      where: { orgScopeId: scope.id, sourceRoomId: { not: null } },
      select: {
        sourceRoomId: true,
        sourceDescription: true,
        sourceMappingReportId: true,
      },
      orderBy: { sourceRoomId: 'asc' },
    });

    const rooms = new Map<string, {
      roomId: string;
      description: string | null;
      mappedItemCount: number;
    }>();
    for (const row of rows) {
      if (!row.sourceRoomId) continue;
      const current = rooms.get(row.sourceRoomId) ?? {
        roomId: row.sourceRoomId,
        description: row.sourceDescription?.trim() || null,
        mappedItemCount: 0,
      };
      if (!current.description && row.sourceDescription?.trim()) {
        current.description = row.sourceDescription.trim();
      }
      if (row.sourceMappingReportId?.trim()) current.mappedItemCount += 1;
      rooms.set(row.sourceRoomId, current);
    }

    return [...rooms.values()].map(({ roomId, description, mappedItemCount }) => ({
      description,
      ...mappingStatusFromProvenance(roomId, mappedItemCount),
    }));
  }

  async getSourceRoomDetails(
    user: CurrentUser,
    orgScopeId: string,
    sourceRoomId: string,
  ) {
    const scope = await this.getScope(user, orgScopeId);
    return this.resolveSourceRoom(db, scope, sourceRoomId);
  }

  async getMappingStatus(
    user: CurrentUser,
    orgScopeId: string,
    sourceRoomId?: string,
  ): Promise<RoomMappingStatus> {
    const scope = await this.getScope(user, orgScopeId);
    if (!sourceRoomId) return mappingStatusFromProvenance(undefined, 0);
    return (await this.resolveSourceRoom(db, scope, sourceRoomId)).mappingStatus;
  }

  async listEligibleItems(
    user: CurrentUser,
    orgScopeId: string,
    sourceRoomId?: string,
  ) {
    const scope = await this.getScope(user, orgScopeId);
    if (!sourceRoomId) return [];
    await this.resolveSourceRoom(db, scope, sourceRoomId);

    return db.item.findMany({
      where: eligibleItemsWhere(scope.id, sourceRoomId),
      select: {
        id: true,
        description: true,
        quantity: true,
        sourceRoomId: true,
        sourceDescription: true,
        sourceMappingReportId: true,
        destinationDescription: true,
      },
      orderBy: [{ sourceRoomId: 'asc' }, { description: 'asc' }],
    });
  }

  async listEligiblePackingUnits(user: CurrentUser, orgScopeId: string) {
    await this.getScope(user, orgScopeId);

    const units = await db.packingUnit.findMany({
      where: {
        orgScopeId,
        shipmentId: null,
        status: PackingUnitStatus.not_sent,
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    return units.map((unit) => ({
      ...unit,
      displaySerial: formatSerial(unit.serialNumber),
    }));
  }

  async create(user: CurrentUser, input: CreatePackingUnitInput) {
    const duplicateItemIds = new Set(input.items.map((item) => item.itemId));
    if (duplicateItemIds.size !== input.items.length) {
      throw new ConflictException('אותו פריט נבחר יותר מפעם אחת');
    }
    if (
      input.packingUnitType === 'personal_carton' &&
      input.items.length > 0
    ) {
      throw new ConflictException('קרטון אישי אינו כולל פריטים');
    }

    const existing = await db.packingUnit.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true, createdBy: true, orgScope: true, destination: true },
    });
    if (existing) {
      if (
        existing.orgScopeId !== input.orgScopeId ||
        existing.createdByUserId !== user.id
      ) {
        throw new ConflictException('מפתח הפעולה כבר שייך לפעולת אריזה אחרת');
      }
      return {
        ...this.toSuccessResponse(existing, user.email),
      };
    }

    try {
      const created = await db.$transaction(
        async (tx) => {
          const scope = await tx.orgScope.findUnique({
            where: { id: input.orgScopeId },
          });
          if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
          assertCanCreatePackingUnit(user.access, scope.mador, scope.orgCode?.trim().slice(0, 2));

          const sourceRoom = await this.resolveSourceRoom(
            tx,
            scope,
            input.sourceRoomId,
          );
          const destination = await this.resolveDestination(
            tx,
            scope.id,
            user.id,
            input.destination,
          );

          if (input.packingUnitType !== 'personal_carton') {
            if (!sourceRoom.mappingStatus.completed) {
              throw new ConflictException('*יש לסיים את המיפוי');
            }
          }

          const packingUnit = await tx.packingUnit.create({
            data: {
              description: input.description,
              status: PackingUnitStatus.not_sent,
              packingUnitType: input.packingUnitType,
              sourceRoomId: input.sourceRoomId,
              sourceDescription: sourceRoom.description,
              destinationId: destination.id,
              destinationRoomId: destination.destinationCode,
              destinationDescription: serializeDestination(destination),
              orgScopeId: scope.id,
              ownerUserId: user.id,
              createdByUserId: user.id,
              idempotencyKey: input.idempotencyKey,
            },
          });

          for (const selected of input.items) {
            const item = await tx.item.findUnique({
              where: { id: selected.itemId },
            });
            if (!item) throw new NotFoundException('אחד הפריטים לא נמצא');
            if (item.orgScopeId !== scope.id) {
              throw new ConflictException('הפריט אינו שייך למסגרת שנבחרה');
            }
            if (
              item.packingUnitId !== null ||
              item.status !== ItemStatus.not_sent
            ) {
              throw new ConflictException('הפריט כבר נארז או אינו זמין');
            }
            if (item.sourceRoomId !== input.sourceRoomId) {
              throw new ConflictException('הפריט אינו שייך לחדר המקור שנבחר');
            }
            if (
              input.packingUnitType !== 'personal_carton' &&
              !item.sourceMappingReportId?.trim()
            ) {
              throw new ConflictException('הפריט אינו ממופה ואינו זמין לאריזה');
            }

            const split = planQuantitySplit(item.quantity, selected.quantity);
            assertItemTransition(
              item.status,
              ItemStatus.assigned_to_packing_unit,
            );

            if (split.isFullQuantity) {
              const claim = await tx.item.updateMany({
                where: {
                  id: item.id,
                  packingUnitId: null,
                  status: ItemStatus.not_sent,
                  quantity: item.quantity,
                },
                data: {
                  packingUnitId: packingUnit.id,
                  status: ItemStatus.assigned_to_packing_unit,
                  ownerUserId: user.id,
                },
              });
              assertClaimSucceeded(claim.count);
            } else {
              const claim = await tx.item.updateMany({
                where: {
                  id: item.id,
                  packingUnitId: null,
                  status: ItemStatus.not_sent,
                  quantity: item.quantity,
                },
                data: { quantity: split.remaining },
              });
              assertClaimSucceeded(claim.count);

              await tx.item.create({
                data: {
                  description: item.description,
                  packingUnitId: packingUnit.id,
                  status: ItemStatus.assigned_to_packing_unit,
                  sourceMappingReportId: item.sourceMappingReportId,
                  sourceRoomId: item.sourceRoomId,
                  sourceDescription: item.sourceDescription,
                  destinationRoomId: item.destinationRoomId,
                  destinationDescription: item.destinationDescription,
                  orgScopeId: item.orgScopeId,
                  ownerUserId: user.id,
                  createdByUserId: user.id,
                  quantity: split.selected,
                },
              });
            }
          }

          await tx.operationEvent.create({
            data: {
              actorUserId: user.id,
              entityType: 'packing_unit',
              entityId: packingUnit.id,
              action: 'packed',
              nextState: {
                status: packingUnit.status,
                itemCount: input.items.length,
              },
            },
          });

          return tx.packingUnit.findUniqueOrThrow({
            where: { id: packingUnit.id },
            include: { items: true, createdBy: true, orgScope: true, destination: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.toSuccessResponse(created, user.email);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await db.packingUnit.findFirst({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true, createdBy: true, orgScope: true, destination: true },
        });
        if (duplicate) {
          if (
            duplicate.orgScopeId !== input.orgScopeId ||
            duplicate.createdByUserId !== user.id
          ) {
            throw new ConflictException('מפתח הפעולה כבר שייך לפעולת אריזה אחרת');
          }
          return this.toSuccessResponse(duplicate, user.email);
        }
      }
      throw error;
    }
  }

  private toSuccessResponse(
    unit: Prisma.PackingUnitGetPayload<{
      include: { items: true; createdBy: true; orgScope: true; destination: true };
    }>,
    fallbackPacker: string,
  ) {
    const destination = parseDestination(unit.destinationDescription);
    return {
      packingUnit: {
        id: unit.id,
        description: unit.description,
        serialNumber: unit.serialNumber,
        displaySerial: formatSerial(unit.serialNumber),
        type: unit.packingUnitType,
        status: unit.status,
        itemCount: unit.items.length,
      },
      source: {
        orgScopeId: unit.orgScopeId,
        unit: unit.orgScope.unit,
        anaf: unit.orgScope.anaf,
        mador: unit.orgScope.mador,
        team: unit.orgScope.team,
        room: unit.sourceRoomId,
        sourceDescription: unit.sourceDescription,
      },
      destination: destination ?? {
        id: unit.destinationId,
        code: unit.destination?.destinationCode ?? unit.destinationRoomId ?? '',
        description: unit.destination?.description ?? '',
        building: '',
        floor: '',
        room: unit.destinationRoomId ?? '',
      },
      responsibilities: {
        madorResponsible: 'לא הוגדר',
        roomResponsible: 'לא הוגדר',
        packer: unit.createdBy.email || fallbackPacker,
      },
      items: unit.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
      })),
    };
  }
}
