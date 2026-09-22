import { PackingUnitStatus, Prisma, PrismaClient } from '@prisma/client';
import { db } from '../lib/db.js';

export class PackingUnitRepository {
  constructor(private readonly client: PrismaClient = db) {}

  create(input: Prisma.PackingUnitUncheckedCreateInput) {
    return this.client.packingUnit.create({ data: input });
  }

  getById(id: string) {
    return this.client.packingUnit.findUnique({
      where: { id },
      include: { items: true, shipment: true, orgScope: true },
    });
  }

  listByShipment(shipmentId: string) {
    return this.client.packingUnit.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  assignToShipment(id: string, shipmentId: string) {
    return this.client.packingUnit.update({
      where: { id },
      data: { shipmentId },
    });
  }

  unassignFromShipment(id: string) {
    return this.client.packingUnit.update({
      where: { id },
      data: { shipmentId: null },
    });
  }

  updateStatus(id: string, status: PackingUnitStatus) {
    return this.client.packingUnit.update({
      where: { id },
      data: { status },
    });
  }
}
