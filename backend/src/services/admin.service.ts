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
    const [users, allMappings] = await Promise.all([
      db.user.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      db.orgHierarchyMapping.findMany(),
    ]);

    const byLevelCode = new Map(allMappings.map((m) => [`${m.level}:${m.code}`, m.textValue]));
    const resolve = (orgCode: string) => ({
      unit: byLevelCode.get(`unit:${orgCode.substring(0, 2)}`) ?? orgCode.substring(0, 2),
      anaf: byLevelCode.get(`anaf:${orgCode.substring(2, 4)}`) ?? orgCode.substring(2, 4),
      mador: byLevelCode.get(`mador:${orgCode.substring(4, 6)}`) ?? orgCode.substring(4, 6),
      team: byLevelCode.get(`team:${orgCode.substring(6, 8)}`) ?? orgCode.substring(6, 8),
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      personalNumber: u.personalNumber,
      role: u.role,
      orgCode: u.orgCode,
      orgNames: u.orgCode?.length === 8 ? resolve(u.orgCode) : null,
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
