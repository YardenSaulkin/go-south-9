import { ItemStatus, Prisma, PrismaClient } from '@prisma/client';
import { db } from '../lib/db.js';

export class ItemRepository {
  constructor(private readonly client: PrismaClient = db) {}

  create(input: Prisma.ItemUncheckedCreateInput) {
    return this.client.item.create({ data: input });
  }

  getById(id: string) {
    return this.client.item.findUnique({
      where: { id },
      include: { packingUnit: true, orgScope: true },
    });
  }

  listByPackingUnit(packingUnitId: string) {
    return this.client.item.findMany({
      where: { packingUnitId },
      orderBy: { createdAt: 'desc' },
    });
  }

  assignToPackingUnit(id: string, packingUnitId: string) {
    return this.client.item.update({
      where: { id },
      data: { packingUnitId },
    });
  }

  unassignFromPackingUnit(id: string) {
    return this.client.item.update({
      where: { id },
      data: { packingUnitId: null },
    });
  }

  updateStatus(id: string, status: ItemStatus) {
    return this.client.item.update({
      where: { id },
      data: { status },
    });
  }

  lookupBySourceMappingReportId(sourceMappingReportId: string) {
    return this.client.item.findMany({ where: { sourceMappingReportId } });
  }

  lookupBySourceRoomId(sourceRoomId: string) {
    return this.client.item.findMany({ where: { sourceRoomId } });
  }
}
