import {
  ConflictException,
  ForbiddenException,
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
import { assertCanApproveShipment } from '../domain/permissions.js';
import { assertShipmentTransition } from '../domain/status-transitions.js';
import { db } from '../lib/db.js';

@Injectable()
export class PocService {
  async getUnitDashboard(user: CurrentUser) {
    if (!user.access.accessUnitCode && !user.access.canViewGlobalShipmentsDashboard) {
      throw new ForbiddenException('גישה מותרת לקצין קישור בלבד');
    }

    const whereOrgScope = user.access.canViewGlobalShipmentsDashboard
      ? {}
      : { orgCode: { startsWith: user.access.accessUnitCode! } };

    const orgScopes = await db.orgScope.findMany({ where: whereOrgScope, select: { id: true } });
    const orgScopeIds = orgScopes.map((s) => s.id);

    const shipments = await db.shipment.findMany({
      where: { orgScopeId: { in: orgScopeIds } },
      include: {
        orgScope: true,
        packingUnits: {
          include: { items: true },
          orderBy: { serialNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pending = shipments.filter((s) => s.status === ShipmentStatus.arrived);
    const verified = shipments.filter((s) => s.status === ShipmentStatus.verified);

    const isAdmin = user.access.canViewGlobalShipmentsDashboard;

    return { shipments, pending, verified, unitNames: isAdmin ? {} : undefined };
  }

  async verifyShipment(user: CurrentUser, shipmentId: string) {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        orgScope: true,
        packingUnits: { include: { items: true } },
      },
    });
    if (!shipment) throw new NotFoundException('ההובלה לא נמצאה');

    assertCanApproveShipment(user.access, shipment.orgScope.orgCode ?? null);
    assertShipmentTransition(shipment.status, ShipmentStatus.verified);

    await db.$transaction(
      async (tx) => {
        for (const pu of shipment.packingUnits) {
          if (pu.status === PackingUnitStatus.arrived_pending_verification) {
            await tx.packingUnit.update({
              where: { id: pu.id },
              data: { status: PackingUnitStatus.verified },
            });
            await tx.item.updateMany({
              where: {
                packingUnitId: pu.id,
                status: ItemStatus.arrived_pending_verification,
              },
              data: { status: ItemStatus.verified },
            });
          }
        }

        const updatedShipment = await tx.shipment.updateMany({
          where: { id: shipmentId, status: ShipmentStatus.arrived },
          data: { status: ShipmentStatus.verified },
        });
        if (updatedShipment.count !== 1) {
          throw new ConflictException('ההובלה כבר אומתה או שונתה. יש לרענן.');
        }

        await tx.operationEvent.create({
          data: {
            actorUserId: user.id,
            entityType: 'shipment',
            entityId: shipmentId,
            action: 'poc_verified',
            previousState: { status: shipment.status },
            nextState: { status: ShipmentStatus.verified },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { success: true };
  }
}
