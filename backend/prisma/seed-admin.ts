import { UserRole } from '@prisma/client';
import { db } from '../src/lib/db.js';

async function main() {
  const existing = await db.user.findFirst({ where: { role: UserRole.admin } });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    return;
  }

  const admin = await db.user.create({
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@go-south.mil',
      personalNumber: process.env.ADMIN_PERSONAL_NUMBER ?? '0000000',
      firstName: 'מנהל',
      lastName: 'מערכת',
      role: UserRole.admin,
      orgCode: '00000000',
    },
  });

  console.log('Admin seeded:', admin.email, 'personal number:', admin.personalNumber);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
