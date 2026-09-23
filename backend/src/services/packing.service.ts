import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemStatus,
  PackingUnitStatus,
  PackingUnitType,
  Prisma,
  type OrgScope,
} from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import {
  formatDestinationDescription,
  type DestinationSelection,
} from '../domain/destination.js';
import {
  mappingStatusFromProvenance,
  type RoomMappingStatus,
} from '../domain/mapping.js';
import type { CreatePackingUnitInput } from '../domain/operations.schemas.js';
import { parseOrgCode } from '../domain/org-code.js';
import {
  assertCanAccessOrgScope,
  assertCanCreatePackingUnit,
} from '../domain/permissions.js';
import { formatSerial, planQuantitySplit } from '../domain/quantities.js';
import {
  assertClaimSucceeded,
  assertItemTransition,
} from '../domain/status-transitions.js';
import { db } from '../lib/db.js';
import {
  findPersistedDestinationById,
  type DestinationCatalogEntry,
} from './destination.service.js';

export interface SourceRoomDetails {
  id: string;
  description: string | null;
  mappingStatus: RoomMappingStatus;
  roomResponsible: null;
  orgCode: string | null;
}

export function eligibleItemsWhere(
  orgScopeId: string,
  sourceRoomId: string,
): Prisma.ItemWhereInput {
  return {
    orgScopeId,
    sourceRoomId,
    status: ItemStatus.not_sent,
    packingUnitId: null,
    sourceMappingReportId: { not: '' },
    quantity: { gt: 0 },
  };
}

@Injectable()
export class PackingService {
  private async loadPackingUnit(id: string) {
    return db.packingUnit.findUniqueOrThrow({
      where: { id },
      include: { items: true, createdBy: true, orgScope: true },
    });
  }

  private async getScope(user: CurrentUser, orgScopeId: string) {
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessOrgScope(user.access, scope.mador, scope.orgCode);
    return scope;
  }

  private async resolveSourceRoom(
    client: Prisma.TransactionClient,
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

    const description =
      rows.find((row) => row.sourceDescription?.trim())?.sourceDescription?.trim() ??
      null;
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
    selection: DestinationSelection,
  ): Promise<DestinationCatalogEntry> {
    const existing = await findPersistedDestinationById(
      client,
      selection.mode === 'existing' ? orgScopeId : undefined,
      selection.destinationId,
    );

    if (selection.mode === 'existing') {
      if (!existing) {
        throw new NotFoundException('היעד לא קיים במסגרת הארגונית שנבחרה');
      }
      return existing;
    }

    if (existing) {
      throw new ConflictException('יעד עם מזהה זה כבר קיים');
    }

    return {
      id: selection.destinationId.trim(),
      description: formatDestinationDescription(selection),
    };
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

    const rooms = new Map<
      string,
      {
        roomId: string;
        description: string | null;
        mappedItemCount: number;
      }
    >();
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

    return [...rooms.values()].map(
      ({ roomId, description, mappedItemCount }) => ({
        description,
        ...mappingStatusFromProvenance(roomId, mappedItemCount),
      }),
    );
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
      input.packingUnitType === PackingUnitType.personal_carton &&
      input.items.length > 0
    ) {
      throw new ConflictException('קרטון אישי אינו כולל פריטים');
    }
    if (
      input.packingUnitType !== PackingUnitType.personal_carton &&
      input.items.length === 0
    ) {
      throw new ConflictException('יש לבחור לפחות פריט אחד ליחידת אריזה זו');
    }

    const existing = await db.packingUnit.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true, createdBy: true, orgScope: true },
    });
    if (existing) {
      if (
        existing.orgScopeId !== input.orgScopeId ||
        existing.createdByUserId !== user.id
      ) {
        throw new ConflictException('מפתח הפעולה כבר שייך לפעולת אריזה אחרת');
      }
      return this.toSuccessResponse(existing, user.email);
    }

    // These reads establish a valid source and canonical destination before the
    // atomic write. Item eligibility is still rechecked by `tx` below.
    const scope = await this.getScope(user, input.orgScopeId);
    assertCanCreatePackingUnit(user.access, scope.mador, scope.orgCode);
    const sourceRoom = await this.resolveSourceRoom(
      db,
      scope,
      input.sourceRoomId,
    );
    if (
      input.packingUnitType !== PackingUnitType.personal_carton &&
      !sourceRoom.mappingStatus.completed
    ) {
      throw new ConflictException('*יש לסיים את המיפוי');
    }
    const destination = await this.resolveDestination(
      db,
      scope.id,
      input.destination,
    );

    try {
      const packingUnitId = await db.$transaction(
        async (tx) => {
          const packingUnit = await tx.packingUnit.create({
            data: {
              description: input.description,
              status: PackingUnitStatus.not_sent,
              packingUnitType: input.packingUnitType,
              sourceRoomId: input.sourceRoomId,
              sourceDescription: sourceRoom.description,
              destinationRoomId: destination.id,
              destinationDescription: destination.description,
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
              item.status !== ItemStatus.not_sent ||
              item.quantity <= 0
            ) {
              throw new ConflictException('הפריט כבר נארז או אינו זמין');
            }
            if (item.sourceRoomId !== input.sourceRoomId) {
              throw new ConflictException('הפריט אינו שייך לחדר המקור שנבחר');
            }
            if (!item.sourceMappingReportId?.trim()) {
              throw new ConflictException('הפריט אינו ממופה ואינו זמין לאריזה');
            }

            const split = planQuantitySplit(item.quantity, selected.quantity);
            assertItemTransition(item.status, ItemStatus.assigned_to_packing_unit);

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

          return packingUnit.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15_000,
        },
      );

      return this.toSuccessResponse(
        await this.loadPackingUnit(packingUnitId),
        user.email,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await db.packingUnit.findFirst({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true, createdBy: true, orgScope: true },
        });
        if (duplicate) {
          if (
            duplicate.orgScopeId !== input.orgScopeId ||
            duplicate.createdByUserId !== user.id
          ) {
            throw new ConflictException(
              'מפתח הפעולה כבר שייך לפעולת אריזה אחרת',
            );
          }
          return this.toSuccessResponse(duplicate, user.email);
        }
      }
      throw error;
    }
  }

  private toSuccessResponse(
    unit: Prisma.PackingUnitGetPayload<{
      include: { items: true; createdBy: true; orgScope: true };
    }>,
    fallbackPacker: string,
  ) {
    const hierarchy = unit.orgScope.orgCode
      ? parseOrgCode(unit.orgScope.orgCode)
      : null;
    const displayName = [unit.createdBy.firstName, unit.createdBy.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

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
        unit: hierarchy?.unitCode ?? null,
        anaf: hierarchy?.anafCode ?? null,
        mador: hierarchy?.madorCode ?? unit.orgScope.mador,
        team: hierarchy?.teamCode ?? null,
        roomId: unit.sourceRoomId,
        roomDisplayName: unit.sourceRoomId,
        description: unit.sourceDescription,
      },
      destination: {
        id: unit.destinationRoomId ?? '',
        description: unit.destinationDescription ?? '',
      },
      responsiblePeople: {
        mador: null,
        room: null,
        packer: {
          userId: unit.createdBy.id,
          firstName: unit.createdBy.firstName,
          lastName: unit.createdBy.lastName,
          personalNumber: unit.createdBy.personalNumber,
          email: unit.createdBy.email || fallbackPacker,
          displayName: displayName || unit.createdBy.email || fallbackPacker,
        },
      },
      items: unit.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
      })),
    };
  }
}
