import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.service.js';
import { db } from '../lib/db.js';

@Injectable()
export class DashboardService {
  async get(user: CurrentUser) {
    let scopeFilter: object;
    if (user.access.canViewGlobalShipmentsDashboard) {
      scopeFilter = {};
    } else if (user.access.accessUnitCode) {
      scopeFilter = { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } };
    } else {
      scopeFilter = { orgScope: { mador: user.access.accessMador ?? '' } };
    }

    const discrepancyScopeFilter = user.access.canViewGlobalShipmentsDashboard
      ? {}
      : user.access.accessUnitCode
        ? {
            OR: [
              { shipment: { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } } },
              { packingUnit: { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } } },
            ],
          }
        : {
            OR: [
              { shipment: { orgScope: { mador: user.access.accessMador ?? '' } } },
              { packingUnit: { orgScope: { mador: user.access.accessMador ?? '' } } },
            ],
          };

    const [items, packingUnits, shipments, discrepancies] = await Promise.all([
      db.item.groupBy({ by: ['status'], where: scopeFilter, _count: { _all: true }, _sum: { quantity: true } }),
      db.packingUnit.groupBy({ by: ['status'], where: scopeFilter, _count: { _all: true } }),
      db.shipment.groupBy({ by: ['status'], where: scopeFilter, _count: { _all: true } }),
      db.discrepancy.count({ where: { status: { in: ['pending', 'finalized'] }, ...discrepancyScopeFilter } }),
    ]);

    return { items, packingUnits, shipments, discrepancies };
  }
}
