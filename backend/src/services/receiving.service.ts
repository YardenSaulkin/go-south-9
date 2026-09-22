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
import type { ReceivingInput } from '../domain/operations.schemas.js';
import { assertCanAccessMador } from '../domain/permissions.js';
import {
  assertPackingUnitTransition,
  assertShipmentTransition,
} from '../domain/status-transitions.js';
import { formatSerial } from '../domain/quantities.js';
import { summarizeReceiving } from '../domain/receiving.js';
import { db } from '../lib/db.js';

@Injectable()
export class ReceivingService {
  async listActive(user: CurrentUser, orgScopeId?: string) {
    if (orgScopeId) {
      const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
      if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
      assertCanAccessMador(user.access, scope.mador, scope.orgCode?.trim().slice(0, 2));
    }

    const shipments = await db.shipment.findMany({
      where: {
        status: { in: [ShipmentStatus.sent, ShipmentStatus.arrived] },
        ...(orgScopeId
          ? { orgScopeId }
          : user.access.canViewGlobalShipmentsDashboard
            ? {}
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
    assertCanAccessMador(user.access, shipment.orgScope.mador, shipment.orgScope.orgCode?.trim().slice(0, 2));

    const summary = summarizeReceiving(
      shipment.packingUnits.map((unit) => unit.id),
      input.arrivedPackingUnitIds,
    );
    if (!input.finalConfirmation) return { ...summary, finalized: false };
    if (shipment.status !== ShipmentStatus.sent) {
      throw new ConflictException('ההובלה כבר נקלטה או השתנתה. יש לרענן.');
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
          if (freshShipment.status !== ShipmentStatus.sent) {
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

          assertShipmentTransition(
            freshShipment.status,
            ShipmentStatus.arrived,
          );
          await tx.shipment.update({
            where: { id: shipmentId },
            data: { status: ShipmentStatus.arrived },
          });
          await tx.operationEvent.create({
            data: {
              actorUserId: user.id,
              entityType: 'shipment',
              entityId: shipmentId,
              action: 'receiving_finalized',
              previousState: { status: freshShipment.status },
              nextState: {
                status: ShipmentStatus.arrived,
                ...summary,
              },
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
}
