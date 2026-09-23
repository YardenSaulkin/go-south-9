import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiscrepancyKind,
  DiscrepancyStatus,
  ItemStatus,
  PackingUnitStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import type {
  ReceivePackingUnitsInput,
  ReceivingInput,
} from '../domain/operations.schemas.js';
import { assertCanAccessMador, assertCanAccessOrgScope } from '../domain/permissions.js';
import {
  assertPackingUnitTransition,
  assertShipmentTransition,
} from '../domain/status-transitions.js';
import { formatSerial } from '../domain/quantities.js';
import { summarizeReceiving } from '../domain/receiving.js';
import { db } from '../lib/db.js';

// A packing unit counts as arrived once it has been unloaded, whether or not
// the POC has verified its contents yet.
const ARRIVED_STATUSES: PackingUnitStatus[] = [
  PackingUnitStatus.arrived_pending_verification,
  PackingUnitStatus.verified,
];

@Injectable()
export class ReceivingService {
  async listActive(user: CurrentUser, orgScopeId?: string) {
    if (orgScopeId) {
      const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
      if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
      assertCanAccessOrgScope(user.access, scope.mador, scope.orgCode ?? null);
    }

    const shipments = await db.shipment.findMany({
      where: {
        status: ShipmentStatus.arrived,
        ...(orgScopeId
          ? { orgScopeId }
          : user.access.canViewGlobalShipmentsDashboard
            ? {}
            : user.access.accessUnitCode
              ? { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } }
              : { orgScope: { mador: user.access.accessMador ?? '' } }),
      },
      include: {
        packingUnits: {
          include: { items: true },
          orderBy: { serialNumber: 'asc' },
        },
      },
      orderBy: { transportAt: 'desc' },
    });

    return shipments.map((shipment) => ({
      ...shipment,
      packingUnits: shipment.packingUnits.map((unit) => ({
        ...unit,
        displaySerial: formatSerial(unit.serialNumber),
      })),
    }));
  }

  async confirm(user: CurrentUser, shipmentId: string, input: ReceivingInput) {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: { orgScope: true, packingUnits: true },
    });
    if (!shipment) throw new NotFoundException('ההובלה לא נמצאה');
    assertCanAccessOrgScope(user.access, shipment.orgScope.mador, shipment.orgScope.orgCode ?? null);

    const summary = summarizeReceiving(
      shipment.packingUnits.map((unit) => unit.id),
      input.arrivedPackingUnitIds,
    );
    if (!input.finalConfirmation) return { ...summary, finalized: false };
    if (shipment.status !== ShipmentStatus.arrived) {
      throw new ConflictException('יש לוודא שקצין הקישור אישר הגעת ההובלה לפני הקליטה.');
    }

    const existingRequest = await db.operationRequest.findUnique({
      where: {
        operation_idempotencyKey: {
          operation: 'receive_shipment',
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existingRequest?.result) return existingRequest.result;

    try {
      return await db.$transaction(
        async (tx) => {
          const request = await tx.operationRequest.create({
            data: {
              operation: 'receive_shipment',
              idempotencyKey: input.idempotencyKey,
              actorUserId: user.id,
            },
          });

          const freshShipment = await tx.shipment.findUniqueOrThrow({
            where: { id: shipmentId },
            include: { packingUnits: true },
          });
          if (freshShipment.status !== ShipmentStatus.arrived) {
            throw new ConflictException('ההובלה השתנתה בידי משתמש אחר');
          }

          for (const unit of freshShipment.packingUnits) {
            if (summary.arrivedIds.includes(unit.id)) {
              assertPackingUnitTransition(
                unit.status,
                PackingUnitStatus.arrived_pending_verification,
              );
              const update = await tx.packingUnit.updateMany({
                where: {
                  id: unit.id,
                  status: PackingUnitStatus.in_transit,
                },
                data: {
                  status: PackingUnitStatus.arrived_pending_verification,
                },
              });
              if (update.count !== 1) {
                throw new ConflictException(
                  'מצב יחידת אריזה השתנה. יש לרענן ולבדוק שוב.',
                );
              }
              await tx.item.updateMany({
                where: {
                  packingUnitId: unit.id,
                  status: ItemStatus.in_transit,
                },
                data: { status: ItemStatus.arrived_pending_verification },
              });
            } else {
              await tx.discrepancy.create({
                data: {
                  kind: DiscrepancyKind.missing_packing_unit,
                  status: DiscrepancyStatus.finalized,
                  shipmentId,
                  packingUnitId: unit.id,
                  expectedQuantity: 1,
                  actualQuantity: 0,
                  createdByUserId: user.id,
                  finalizedByUserId: user.id,
                  finalizedAt: new Date(),
                },
              });
            }
          }

          await tx.operationEvent.create({
            data: {
              actorUserId: user.id,
              entityType: 'shipment',
              entityId: shipmentId,
              action: 'receiving_finalized',
              previousState: { status: freshShipment.status },
              nextState: { ...summary },
            },
          });

          const result: Prisma.JsonObject = {
            expectedCount: summary.expectedCount,
            receivedCount: summary.receivedCount,
            missingCount: summary.missingCount,
            finalized: true,
          };
          await tx.operationRequest.update({
            where: { id: request.id },
            data: { result },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await db.operationRequest.findUnique({
          where: {
            operation_idempotencyKey: {
              operation: 'receive_shipment',
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (duplicate?.result) return duplicate.result;
      }
      throw error;
    }
  }

  // Marks the packing units the user just unloaded as arrived. Unlike
  // confirm(), this can run several times for the same shipment: the shipment
  // itself only moves to arrived once nothing is left in transit.
  async receivePackingUnits(
    user: CurrentUser,
    shipmentId: string,
    input: ReceivePackingUnitsInput,
  ) {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: { orgScope: true, packingUnits: true },
    });
    if (!shipment) throw new NotFoundException('ההובלה לא נמצאה');
    assertCanAccessOrgScope(
      user.access,
      shipment.orgScope.mador,
      shipment.orgScope.orgCode ?? null,
    );

    const selectedIds = [...new Set(input.packingUnitIds)];
    if (selectedIds.length !== input.packingUnitIds.length) {
      throw new ConflictException('יחידת אריזה סומנה יותר מפעם אחת');
    }
    const shipmentUnitIds = new Set(shipment.packingUnits.map((u) => u.id));
    if (selectedIds.some((id) => !shipmentUnitIds.has(id))) {
      throw new ConflictException('סומנה יחידת אריזה שאינה שייכת להובלה');
    }
    if (shipment.status !== ShipmentStatus.sent) {
      throw new ConflictException('ההובלה כבר נקלטה או השתנתה. יש לרענן.');
    }

    const existingRequest = await db.operationRequest.findUnique({
      where: {
        operation_idempotencyKey: {
          operation: 'receive_packing_units',
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existingRequest?.result) return this.shipmentState(shipmentId);

    try {
      await db.$transaction(
        async (tx) => {
          const freshShipment = await tx.shipment.findUniqueOrThrow({
            where: { id: shipmentId },
            include: { packingUnits: { select: { id: true, status: true } } },
          });
          if (freshShipment.status !== ShipmentStatus.sent) {
            throw new ConflictException('ההובלה השתנתה בידי משתמש אחר');
          }

          // Units another receiver already marked need no work. Everything else
          // makes the same transition, so it all moves in one statement rather
          // than two round trips per unit.
          const pending = freshShipment.packingUnits.filter(
            (unit) =>
              selectedIds.includes(unit.id) &&
              !ARRIVED_STATUSES.includes(unit.status),
          );
          for (const unit of pending) {
            assertPackingUnitTransition(
              unit.status,
              PackingUnitStatus.arrived_pending_verification,
            );
          }
          const receivedIds = pending.map((unit) => unit.id);

          if (receivedIds.length > 0) {
            const claim = await tx.packingUnit.updateMany({
              where: {
                id: { in: receivedIds },
                status: PackingUnitStatus.in_transit,
              },
              data: { status: PackingUnitStatus.arrived_pending_verification },
            });
            if (claim.count !== receivedIds.length) {
              throw new ConflictException(
                'מצב יחידת אריזה השתנה. יש לרענן ולבדוק שוב.',
              );
            }
            await tx.item.updateMany({
              where: {
                packingUnitId: { in: receivedIds },
                status: ItemStatus.in_transit,
              },
              data: { status: ItemStatus.arrived_pending_verification },
            });
          }

          // The transaction already read every unit of the shipment, so what is
          // still outstanding can be counted in memory.
          const received = new Set(receivedIds);
          const expectedCount = freshShipment.packingUnits.length;
          const missingCount = freshShipment.packingUnits.filter(
            (unit) =>
              !received.has(unit.id) && !ARRIVED_STATUSES.includes(unit.status),
          ).length;
          const finalized = missingCount === 0;

          if (finalized) {
            assertShipmentTransition(
              freshShipment.status,
              ShipmentStatus.arrived,
            );
            await tx.shipment.update({
              where: { id: shipmentId },
              data: { status: ShipmentStatus.arrived },
            });
          }

          await tx.operationEvent.create({
            data: {
              actorUserId: user.id,
              entityType: 'shipment',
              entityId: shipmentId,
              action: finalized
                ? 'receiving_finalized'
                : 'receiving_partial_unload',
              previousState: { status: freshShipment.status },
              nextState: {
                status: finalized
                  ? ShipmentStatus.arrived
                  : freshShipment.status,
                receivedPackingUnitIds: receivedIds,
                expectedCount,
                missingCount,
              },
            },
          });

          // Written last with its result inline: the unique key still rejects a
          // replay, and the row costs one round trip instead of two.
          const result: Prisma.JsonObject = {
            expectedCount,
            receivedCount: expectedCount - missingCount,
            missingCount,
            finalized,
          };
          await tx.operationRequest.create({
            data: {
              operation: 'receive_packing_units',
              idempotencyKey: input.idempotencyKey,
              actorUserId: user.id,
              result,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // The database sits behind a pooler in another region, so every
          // statement costs a real round trip and the 5s default runs out.
          maxWait: 15_000,
          timeout: 30_000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await db.operationRequest.findUnique({
          where: {
            operation_idempotencyKey: {
              operation: 'receive_packing_units',
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (duplicate?.result) return this.shipmentState(shipmentId);
      }
      throw error;
    }

    return this.shipmentState(shipmentId);
  }

  // The shipment as the receiving screens need it: every packing unit, plus the
  // ones still unaccounted for so the UI can ask for another pass.
  private async shipmentState(shipmentId: string) {
    const shipment = await db.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        packingUnits: {
          include: { items: true },
          orderBy: { serialNumber: 'asc' },
        },
      },
    });

    const packingUnits = shipment.packingUnits.map((unit) => ({
      ...unit,
      displaySerial: formatSerial(unit.serialNumber),
    }));
    const remainingPackingUnits = packingUnits.filter(
      (unit) => !ARRIVED_STATUSES.includes(unit.status),
    );

    return {
      shipment: { ...shipment, packingUnits },
      shipmentStatus: shipment.status,
      expectedCount: packingUnits.length,
      receivedCount: packingUnits.length - remainingPackingUnits.length,
      missingCount: remainingPackingUnits.length,
      remainingPackingUnits,
      finalized: remainingPackingUnits.length === 0,
    };
  }
}
