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

    const pending = shipments.filter((s) => s.status === ShipmentStatus.sent);
    const verified = shipments.filter((s) => s.status === ShipmentStatus.verified);

    const isAdmin = user.access.canViewGlobalShipmentsDashboard;

    return { shipments, pending, verified, unitNames: isAdmin ? {} : undefined };
  }

  // Marks a shipment and all its packing units / items as arrived_pending_verification
  // so they appear in the distribution (פיזור) flow. The shipment auto-verifies
  // once every packing unit is fully distributed.
  async confirmArrival(user: CurrentUser, shipmentId: string) {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        orgScope: true,
        packingUnits: { include: { items: true } },
      },
    });
    if (!shipment) throw new NotFoundException('ההובלה לא נמצאה');

    assertCanApproveShipment(user.access, shipment.orgScope.orgCode ?? null);
    assertShipmentTransition(shipment.status, ShipmentStatus.arrived);

    await db.$transaction(
      async (tx) => {
        // Only mark the shipment as arrived — packing units stay in_transit
        // until קבלת ציוד (receiving) is done by the normal user.
        const updatedShipment = await tx.shipment.updateMany({
          where: { id: shipmentId, status: ShipmentStatus.sent },
          data: { status: ShipmentStatus.arrived },
        });
        if (updatedShipment.count !== 1) {
          throw new ConflictException('ההובלה כבר עודכנה או שונתה. יש לרענן.');
        }

        await tx.operationEvent.create({
          data: {
            actorUserId: user.id,
            entityType: 'shipment',
            entityId: shipmentId,
            action: 'poc_confirmed_arrival',
            previousState: { status: shipment.status },
            nextState: { status: ShipmentStatus.arrived },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { success: true };
  }

  // After receiving (קבלת ציוד), the POC reviews packages and signs off
  // before distribution (פיזור ציוד) can begin.
  // Does not change statuses — packages stay arrived_pending_verification
  // so the distribution service can pick them up.
  async confirmPackages(user: CurrentUser, shipmentId: string) {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: { orgScope: true, packingUnits: true },
    });
    if (!shipment) throw new NotFoundException('ההובלה לא נמצאה');
    if (shipment.status !== ShipmentStatus.arrived) {
      throw new ConflictException('ניתן לאשר אריזות רק עבור הובלה שהגיעה');
    }
    assertCanApproveShipment(user.access, shipment.orgScope.orgCode ?? null);

    const arrivedCount = shipment.packingUnits.filter(
      (pu) => pu.status === PackingUnitStatus.arrived_pending_verification,
    ).length;
    if (arrivedCount === 0) {
      throw new ConflictException('אין אריזות שקיבלו קליטה עדיין');
    }

    await db.operationEvent.create({
      data: {
        actorUserId: user.id,
        entityType: 'shipment',
        entityId: shipmentId,
        action: 'poc_confirmed_packages',
        previousState: { arrivedPackages: arrivedCount },
        nextState: { approvedForDistribution: true },
      },
    });

    return { success: true, approvedPackages: arrivedCount };
  }
}
