import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.service.js';
import { db } from '../lib/db.js';

@Injectable()
export class DashboardService {
  async get(user: CurrentUser) {
    const scopeFilter = user.access.canViewGlobalShipmentsDashboard
      ? {}
      : { orgScope: { mador: user.access.accessMador ?? '' } };

    const [items, packingUnits, shipments, discrepancies] = await Promise.all([
      db.item.groupBy({
        by: ['status'],
        where: scopeFilter,
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      db.packingUnit.groupBy({
        by: ['status'],
        where: scopeFilter,
        _count: { _all: true },
      }),
      db.shipment.groupBy({
        by: ['status'],
        where: scopeFilter,
        _count: { _all: true },
      }),
      db.discrepancy.count({
        where: {
          status: { in: ['pending', 'finalized'] },
          ...(user.access.canViewGlobalShipmentsDashboard
            ? {}
            : {
                OR: [
                  {
                    shipment: {
                      orgScope: { mador: user.access.accessMador ?? '' },
                    },
                  },
                  {
                    packingUnit: {
                      orgScope: { mador: user.access.accessMador ?? '' },
                    },
                  },
                ],
              }),
        },
      }),
    ]);

    return { items, packingUnits, shipments, discrepancies };
  }
}
