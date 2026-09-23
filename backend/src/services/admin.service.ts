import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { parseOrgCode } from '../domain/org-code.js';
import { db } from '../lib/db.js';

export interface AdminUserView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  personalNumber: string | null;
  role: UserRole;
  orgCode: string | null;
  orgNames: { unit: string; anaf: string; mador: string; team: string } | null;
}

@Injectable()
export class AdminService {
  async listUsers(): Promise<AdminUserView[]> {
    const users = await db.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      personalNumber: u.personalNumber,
      role: u.role,
      orgCode: u.orgCode,
      orgNames: u.orgCode
        ? (() => {
            const hierarchy = parseOrgCode(u.orgCode);
            return {
              unit: hierarchy.unitCode,
              anaf: hierarchy.anafCode,
              mador: hierarchy.madorCode,
              team: hierarchy.teamCode,
            };
          })()
        : null,
    }));
  }

  async setUserRole(targetUserId: string, newRole: Exclude<UserRole, 'admin'>): Promise<void> {
    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('משתמש לא נמצא');
    if (target.role === UserRole.admin) {
      throw new ForbiddenException('לא ניתן לשנות תפקיד המנהל');
    }

    await db.user.update({ where: { id: targetUserId }, data: { role: newRole } });
  }
}
