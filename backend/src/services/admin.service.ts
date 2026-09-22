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
    const [users, mappings] = await Promise.all([
      db.user.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.orgHierarchy.listAll(),
    ]);
    const namesBySegment = new Map(
      mappings.map((mapping) => [
        `${mapping.level}:${mapping.code}`,
        mapping.textValue,
      ]),
    );

    return users.map((u) => {
      const orgNames = u.orgCode?.length === 8 ? {
        unit: namesBySegment.get(`unit:${u.orgCode.slice(0, 2)}`) ?? u.orgCode.slice(0, 2),
        anaf: namesBySegment.get(`anaf:${u.orgCode.slice(2, 4)}`) ?? u.orgCode.slice(2, 4),
        mador: namesBySegment.get(`mador:${u.orgCode.slice(4, 6)}`) ?? u.orgCode.slice(4, 6),
        team: namesBySegment.get(`team:${u.orgCode.slice(6, 8)}`) ?? u.orgCode.slice(6, 8),
      } : null;

      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        personalNumber: u.personalNumber,
        role: u.role,
        orgCode: u.orgCode,
        orgNames,
      };
    });
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
