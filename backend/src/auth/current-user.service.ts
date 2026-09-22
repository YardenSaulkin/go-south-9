import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { db } from '../lib/db.js';
import type { AccessProfile } from '../domain/permissions.js';
import { uuidSchema } from '../common/validation.js';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  personalNumber: string | null;
  orgScopeId: string | null;
  orgCode: string | null;
  access: AccessProfile;
}

@Injectable()
export class CurrentUserService {
  listDemoUsers() {
    return db.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        personalNumber: true,
        phone: true,
        mador: true,
        team: true,
        orgScopeId: true,
      },
      orderBy: { email: 'asc' },
    });
  }

  async require(headerValue: string | undefined): Promise<CurrentUser> {
    const parsedId = uuidSchema.safeParse(headerValue);
    if (!parsedId.success) {
      throw new UnauthorizedException('יש לבחור משתמש הדגמה תקין');
    }

    const [user, access] = await Promise.all([
      db.user.findUnique({ where: { id: parsedId.data } }),
      db.userAccessProfile.findFirst({ where: { userId: parsedId.data } }),
    ]);

    if (!user || !access) {
      throw new UnauthorizedException('המשתמש אינו קיים או חסר פרופיל הרשאות');
    }

    return {
      id: user.id,
      email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        personalNumber: user.personalNumber,
      orgScopeId: user.orgScopeId,
      orgCode: user.orgCode,
      access: {
        role: access.role,
        accessMador: access.accessMador,
        accessUnitCode: access.accessUnitCode,
        canCreateShipments: access.canCreateShipments,
        canCreatePackingUnits: access.canCreatePackingUnits,
        canViewShipments: access.canViewShipments,
        canViewPackingUnits: access.canViewPackingUnits,
        canViewGlobalShipmentsDashboard: access.canViewGlobalShipmentsDashboard,
        canApproveShipments: access.canApproveShipments,
        dataVisibilityScope: access.dataVisibilityScope,
      },
    };
  }
}
