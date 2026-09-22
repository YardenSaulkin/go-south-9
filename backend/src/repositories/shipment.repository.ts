import { Prisma, PrismaClient, ShipmentStatus } from '@prisma/client';
import { db } from '../lib/db.js';

export class ShipmentRepository {
  constructor(private readonly client: PrismaClient = db) {}

  create(input: Prisma.ShipmentUncheckedCreateInput) {
    return this.client.shipment.create({ data: input });
  }

  getById(id: string) {
    return this.client.shipment.findUnique({
      where: { id },
      include: { packingUnits: true, orgScope: true },
    });
  }

  listByOrgScope(orgScopeId: string) {
    return this.client.shipment.findMany({
      where: { orgScopeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByMador(mador: string) {
    return this.client.shipment.findMany({
      where: { orgScope: { mador } },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateStatus(id: string, status: ShipmentStatus) {
    return this.client.shipment.update({
      where: { id },
      data: { status },
    });
  }
}
