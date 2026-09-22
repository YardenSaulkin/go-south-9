import { PrismaClient } from '@prisma/client';
import { db } from '../lib/db.js';

export class UserRepository {
  constructor(private readonly client: PrismaClient = db) {}

  getById(id: string) {
    return this.client.user.findUnique({
      where: { id },
      include: { orgScope: true },
    });
  }

  getByEmail(email: string) {
    return this.client.user.findFirst({ where: { email } });
  }

  getAccessProfile(userId: string) {
    return this.client.userAccessProfile.findFirst({ where: { userId } });
  }
}
