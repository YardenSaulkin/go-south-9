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
import type { DistributionInput } from '../domain/operations.schemas.js';
import { assertCanAccessMador } from '../domain/permissions.js';
import { formatSerial, summarizeQuantities } from '../domain/quantities.js';
import {
  assertItemTransition,
  assertPackingUnitCanVerify,
  assertPackingUnitTransition,
  assertShipmentCanVerify,
  assertShipmentTransition,
} from '../domain/status-transitions.js';
import { db } from '../lib/db.js';

@Injectable()
export class DistributionService {
  async listArrived(user: CurrentUser, orgScopeId?: string) {
    if (orgScopeId) {
      const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
      if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
      assertCanAccessMador(user.access, scope.mador);
    }

    const units = await db.packingUnit.findMany({
      where: {
        status: PackingUnitStatus.arrived_pending_verification,
        ...(orgScopeId
          ? { orgScopeId }
          : user.access.canViewGlobalShipmentsDashboard
            ? {}
            : { orgScope: { mador: user.access.accessMador ?? '' } }),
      },
      include: { items: true, shipment: true, orgScope: true },
      orderBy: { serialNumber: 'asc' },
    });

    return units.map((unit) => ({
      ...unit,
      displaySerial: formatSerial(unit.serialNumber),
    }));
  }

  async distribute(
    user: CurrentUser,
    packingUnitId: string,
    input: DistributionInput,
  ) {
    const unit = await db.packingUnit.findUnique({
      where: { id: packingUnitId },
      include: { items: true, orgScope: true },
    });
    if (!unit) throw new NotFoundException('יחידת האריזה לא נמצאה');
    assertCanAccessMador(user.access, unit.orgScope.mador);
    if (unit.status !== PackingUnitStatus.arrived_pending_verification) {
      throw new ConflictException('יחידת האריזה אינה ממתינה לפיזור');
    }

    const submitted = new Map(
      input.items.map((item) => [item.itemId, item.actualQuantity]),
    );
    if (submitted.size !== input.items.length) {
      throw new ConflictException('אותו פריט נשלח יותר מפעם אחת');
    }
    if (
      input.items.some(
        (item) => !unit.items.some(({ id }) => id === item.itemId),
      )
    ) {
      throw new ConflictException('נשלח פריט שאינו שייך ליחידת האריזה');
    }

    const lines = unit.items.map((item) => ({
      itemId: item.id,
      description: item.description,
      ...summarizeQuantities(item.quantity, submitted.get(item.id) ?? 0),
    }));
    const preview = {
      packingUnitId,
      expectedQuantity: lines.reduce((sum, line) => sum + line.expected, 0),
      actualQuantity: lines.reduce((sum, line) => sum + line.actual, 0),
      missingQuantity: lines.reduce((sum, line) => sum + line.missing, 0),
      lines,
    };
    if (!input.finalConfirmation) return { ...preview, finalized: false };

    const existingRequest = await db.operationRequest.findUnique({
      where: {
        operation_idempotencyKey: {
          operation: 'distribute_packing_unit',
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
              operation: 'distribute_packing_unit',
              idempotencyKey: input.idempotencyKey,
              actorUserId: user.id,
            },
          });
          const freshUnit = await tx.packingUnit.findUniqueOrThrow({
            where: { id: packingUnitId },
            include: { items: true },
          });
          if (
            freshUnit.status !== PackingUnitStatus.arrived_pending_verification
          ) {
            throw new ConflictException('יחידת האריזה השתנתה בידי משתמש אחר');
          }

          for (const item of freshUnit.items) {
            const actual = submitted.get(item.id) ?? 0;
            const quantity = summarizeQuantities(item.quantity, actual);
            const nextStatus =
              quantity.missing === 0
                ? ItemStatus.verified
                : ItemStatus.arrived_pending_verification;

            if (nextStatus === ItemStatus.verified) {
              assertItemTransition(item.status, nextStatus);
            }
            await tx.item.update({
              where: { id: item.id },
              data: { distributedQuantity: actual, status: nextStatus },
            });

            if (quantity.missing > 0) {
              await tx.discrepancy.create({
                data: {
                  kind: DiscrepancyKind.missing_item,
                  status: DiscrepancyStatus.finalized,
                  packingUnitId,
                  itemId: item.id,
                  expectedQuantity: item.quantity,
                  actualQuantity: actual,
                  createdByUserId: user.id,
                  finalizedByUserId: user.id,
                  finalizedAt: new Date(),
                },
              });
            }
          }

          if (preview.missingQuantity === 0) {
            assertPackingUnitCanVerify(
              freshUnit.items.map(() => ItemStatus.verified),
            );
            assertPackingUnitTransition(
              freshUnit.status,
              PackingUnitStatus.verified,
            );
            await tx.packingUnit.update({
              where: { id: packingUnitId },
              data: { status: PackingUnitStatus.verified },
            });

            if (freshUnit.shipmentId) {
              const shipment = await tx.shipment.findUniqueOrThrow({
                where: { id: freshUnit.shipmentId },
                include: { packingUnits: true },
              });
              const projectedStatuses = shipment.packingUnits.map(
                (candidate) =>
                  candidate.id === freshUnit.id
                    ? PackingUnitStatus.verified
                    : candidate.status,
              );
              if (
                shipment.status === ShipmentStatus.arrived &&
                projectedStatuses.every(
                  (status) => status === PackingUnitStatus.verified,
                )
              ) {
                assertShipmentCanVerify(projectedStatuses);
                assertShipmentTransition(
                  shipment.status,
                  ShipmentStatus.verified,
                );
                await tx.shipment.update({
                  where: { id: shipment.id },
                  data: { status: ShipmentStatus.verified },
                });
              }
            }
          }

          await tx.operationEvent.create({
            data: {
              actorUserId: user.id,
              entityType: 'packing_unit',
              entityId: packingUnitId,
              action: 'distribution_finalized',
              previousState: { status: freshUnit.status },
              nextState: preview,
            },
          });
          const result: Prisma.JsonObject = {
            packingUnitId,
            expectedQuantity: preview.expectedQuantity,
            actualQuantity: preview.actualQuantity,
            missingQuantity: preview.missingQuantity,
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
              operation: 'distribute_packing_unit',
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
