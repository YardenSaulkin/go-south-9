import { PrismaClient } from '@prisma/client';
import { db } from '../lib/db.js';

export class OrgScopeRepository {
  constructor(private readonly client: PrismaClient = db) {}

  getById(id: string) {
    return this.client.orgScope.findUnique({ where: { id } });
  }

  list() {
    return this.client.orgScope.findMany({
      orderBy: [{ mador: 'asc' }, { team: 'asc' }],
    });
  }

  listByMador(mador: string) {
    return this.client.orgScope.findMany({
      where: { mador },
      orderBy: { team: 'asc' },
    });
  }
}
