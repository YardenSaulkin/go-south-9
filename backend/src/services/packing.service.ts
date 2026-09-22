import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemStatus, PackingUnitStatus, Prisma } from '@prisma/client';
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
import { db } from '../lib/db.js';

function serializeDestination(
  destination: CreatePackingUnitInput['destination'],
): string {
  return JSON.stringify(destination);
}

function parseDestination(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as CreatePackingUnitInput['destination'];
  } catch {
    return null;
  }
}

@Injectable()
export class PackingService {
  private async getScope(user: CurrentUser, orgScopeId: string) {
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessMador(user.access, scope.mador);
    return scope;
  }

  async listSourceRooms(user: CurrentUser, orgScopeId: string) {
    const scope = await this.getScope(user, orgScopeId);
    const rows = await db.item.findMany({
      where: { orgScopeId: scope.id, sourceRoomId: { not: null } },
      select: { sourceRoomId: true, sourceMappingReportId: true },
      orderBy: { sourceRoomId: 'asc' },
    });

    const rooms = new Map<string, { roomId: string; mappedItemCount: number }>();
    for (const row of rows) {
      if (!row.sourceRoomId) continue;
      const current = rooms.get(row.sourceRoomId) ?? {
        roomId: row.sourceRoomId,
        mappedItemCount: 0,
      };
      if (row.sourceMappingReportId?.trim()) current.mappedItemCount += 1;
      rooms.set(row.sourceRoomId, current);
    }

    return [...rooms.values()].map(({ roomId, mappedItemCount }) => ({
      ...mappingStatusFromProvenance(roomId, mappedItemCount),
    }));
  }

  async getMappingStatus(
    user: CurrentUser,
    orgScopeId: string,
    sourceRoomId?: string,
  ): Promise<RoomMappingStatus> {
    const scope = await this.getScope(user, orgScopeId);
    if (!sourceRoomId) return mappingStatusFromProvenance(undefined, 0);

    const mappedItemCount = await db.item.count({
      where: {
        orgScopeId: scope.id,
        sourceRoomId,
        sourceMappingReportId: { not: '' },
      },
    });
    return mappingStatusFromProvenance(sourceRoomId, mappedItemCount);
  }

  async listEligibleItems(
    user: CurrentUser,
    orgScopeId: string,
    sourceRoomId?: string,
  ) {
    await this.getScope(user, orgScopeId);

    return db.item.findMany({
      where: {
        orgScopeId,
        packingUnitId: null,
        status: ItemStatus.not_sent,
        sourceMappingReportId: { not: '' },
        ...(sourceRoomId ? { sourceRoomId } : {}),
      },
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

    const existing = await db.packingUnit.findUnique({
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
          assertCanCreatePackingUnit(user.access, scope.mador);

          if (input.packingUnitType !== 'personal_carton') {
            const mappedItemCount = await tx.item.count({
              where: {
                orgScopeId: scope.id,
                sourceRoomId: input.sourceRoomId,
                sourceMappingReportId: { not: '' },
              },
            });
            if (mappedItemCount === 0) {
              throw new ConflictException('*יש לסיים את המיפוי');
            }
          }

          const packingUnit = await tx.packingUnit.create({
            data: {
              description: input.description,
              status: PackingUnitStatus.not_sent,
              packingUnitType: input.packingUnitType,
              sourceRoomId: input.sourceRoomId,
              sourceDescription: input.sourceDescription,
              destinationRoomId:
                input.destination.roomId ?? input.destination.room,
              destinationDescription: serializeDestination(input.destination),
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
            include: { items: true, createdBy: true, orgScope: true },
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
        const duplicate = await db.packingUnit.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true, createdBy: true, orgScope: true },
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
      include: { items: true; createdBy: true; orgScope: true };
    }>,
    fallbackPacker: string,
  ) {
    const destination = parseDestination(unit.destinationDescription);
    return {
      packingUnit: {
        id: unit.id,
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
        room: unit.sourceRoomId,
      },
      destination: destination ?? {
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
