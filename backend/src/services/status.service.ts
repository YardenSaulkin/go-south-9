import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import { formatSerial } from '../domain/quantities.js';
import { db } from '../lib/db.js';

@Injectable()
export class StatusService {
  async getShipmentsStatus(user: CurrentUser) {
    let whereOrgScope: object = {};
    if (!user.access.canViewGlobalShipmentsDashboard) {
      if (user.access.accessUnitCode) {
        whereOrgScope = { orgCode: { startsWith: user.access.accessUnitCode } };
      } else if (user.access.accessMador) {
        whereOrgScope = { mador: user.access.accessMador };
      }
    }

    const orgScopes = await db.orgScope.findMany({
      where: whereOrgScope,
      select: { id: true },
    });
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

  async getPackingUnitsStatus(user: CurrentUser) {
    let where: object = {};
    if (!user.access.canViewGlobalShipmentsDashboard) {
      if (user.access.accessUnitCode) {
        where = { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } };
      } else if (user.access.accessMador) {
        where = { orgScope: { mador: user.access.accessMador } };
      }
    }

    const packingUnits = await db.packingUnit.findMany({
      where,
      include: { orgScope: true },
      orderBy: { createdAt: 'desc' },
    });

    const packingUnitsWithSerial = packingUnits.map((pu) => ({
      ...pu,
      displaySerial: formatSerial(pu.serialNumber),
    }));

    const isAdmin = user.access.canViewGlobalShipmentsDashboard;
    return { packingUnits: packingUnitsWithSerial, unitNames: isAdmin ? {} : undefined };
  }
}
