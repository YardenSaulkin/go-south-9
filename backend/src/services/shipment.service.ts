import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemStatus,
  PackingUnitStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import type { CreateShipmentInput } from '../domain/operations.schemas.js';
import { assertCanCreateShipment } from '../domain/permissions.js';
import {
  assertClaimSucceeded,
  assertPackingUnitTransition,
  assertShipmentTransition,
} from '../domain/status-transitions.js';
import { db } from '../lib/db.js';

@Injectable()
export class ShipmentService {
  async createAndLoad(user: CurrentUser, input: CreateShipmentInput) {
    if (new Set(input.packingUnitIds).size !== input.packingUnitIds.length) {
      throw new ConflictException('אותה יחידת אריזה נבחרה יותר מפעם אחת');
    }

    const existing = await db.shipment.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
      include: { packingUnits: true },
    });
    if (existing) return existing;

    try {
      return await db.$transaction(
        async (tx) => {
          const scope = await tx.orgScope.findUnique({
            where: { id: input.orgScopeId },
          });
          if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
          assertCanCreateShipment(user.access, scope.mador, scope.orgCode);

          const packingUnits = await tx.packingUnit.findMany({
            where: { id: { in: input.packingUnitIds } },
          });
          if (packingUnits.length !== input.packingUnitIds.length) {
            throw new NotFoundException('אחת מיחידות האריזה לא נמצאה');
          }

          const shipment = await tx.shipment.create({
            data: {
              description: input.description,
              status: ShipmentStatus.not_sent,
              destinationRoomId: input.destination
                ? (input.destination.roomId ?? input.destination.room)
                : undefined,
              destinationDescription: input.destination
                ? JSON.stringify(input.destination)
                : undefined,
              orgScopeId: scope.id,
              ownerUserId: user.id,
              createdByUserId: user.id,
              transportType: input.transportType,
              transportDescription: input.transportDescription,
              vehicleIdentifier: input.vehicleIdentifier,
              transportAt: input.transportAt,
              idempotencyKey: input.idempotencyKey,
            },
          });

          for (const packingUnit of packingUnits) {
            if (
              packingUnit.orgScopeId !== scope.id ||
              packingUnit.shipmentId !== null ||
              packingUnit.status !== PackingUnitStatus.not_sent
            ) {
              throw new ConflictException(
                'יחידת אריזה אינה זמינה או אינה שייכת למסגרת שנבחרה',
              );
            }

            assertPackingUnitTransition(
              packingUnit.status,
              PackingUnitStatus.assigned_to_shipment,
            );
            const claim = await tx.packingUnit.updateMany({
              where: {
                id: packingUnit.id,
                shipmentId: null,
                status: PackingUnitStatus.not_sent,
              },
              data: {
                shipmentId: shipment.id,
                status: PackingUnitStatus.assigned_to_shipment,
              },
            });
            assertClaimSucceeded(claim.count);

            assertPackingUnitTransition(
              PackingUnitStatus.assigned_to_shipment,
              PackingUnitStatus.in_transit,
            );
            await tx.packingUnit.update({
              where: { id: packingUnit.id },
              data: { status: PackingUnitStatus.in_transit },
            });
            await tx.item.updateMany({
              where: {
                packingUnitId: packingUnit.id,
                status: ItemStatus.assigned_to_packing_unit,
              },
              data: { status: ItemStatus.in_transit },
            });
          }

          assertShipmentTransition(shipment.status, ShipmentStatus.sent);
          await tx.shipment.update({
            where: { id: shipment.id },
            data: { status: ShipmentStatus.sent },
          });
          await tx.operationEvent.create({
            data: {
              actorUserId: user.id,
              entityType: 'shipment',
              entityId: shipment.id,
              action: 'loaded_and_departed',
              previousState: { status: shipment.status },
              nextState: {
                status: ShipmentStatus.sent,
                packingUnitCount: packingUnits.length,
              },
            },
          });

          return tx.shipment.findUniqueOrThrow({
            where: { id: shipment.id },
            include: { packingUnits: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await db.shipment.findFirst({
          where: { idempotencyKey: input.idempotencyKey },
          include: { packingUnits: true },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }
}
