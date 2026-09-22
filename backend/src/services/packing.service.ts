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
import type { CreatePackingUnitInput } from '../domain/operations.schemas.js';
import { db } from '../lib/db.js';

function serializeDestination(
  destination: CreatePackingUnitInput['destination'],
): string {
  return JSON.stringify(destination);
}

@Injectable()
export class PackingService {
  async listEligibleItems(
    user: CurrentUser,
    orgScopeId: string,
    sourceRoomId?: string,
  ) {
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessMador(user.access, scope.mador);

    return db.item.findMany({
      where: {
        orgScopeId,
        packingUnitId: null,
        status: ItemStatus.not_sent,
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
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessMador(user.access, scope.mador);

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

    const existing = await db.packingUnit.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) {
      return {
        ...existing,
        displaySerial: formatSerial(existing.serialNumber),
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
            include: { items: true, createdBy: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { ...created, displaySerial: formatSerial(created.serialNumber) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await db.packingUnit.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true },
        });
        if (duplicate) {
          return {
            ...duplicate,
            displaySerial: formatSerial(duplicate.serialNumber),
          };
        }
      }
      throw error;
    }
  }
}
