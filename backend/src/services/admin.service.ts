import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { db } from '../lib/db.js';
import { OrgHierarchyService } from './org-hierarchy.service.js';

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
  constructor(private readonly orgHierarchy: OrgHierarchyService) {}

  async listUsers(): Promise<AdminUserView[]> {
    const users = await db.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return Promise.all(
      users.map(async (u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        personalNumber: u.personalNumber,
        role: u.role,
        orgCode: u.orgCode,
        orgNames: u.orgCode ? await this.orgHierarchy.resolveOrgCode(u.orgCode) : null,
      })),
    );
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
