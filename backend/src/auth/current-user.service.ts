import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { db } from '../lib/db.js';
import type { AccessProfile } from '../domain/permissions.js';
import { uuidSchema } from '../common/validation.js';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  orgScopeId: string | null;
  mador: string | null;
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
        orgCode: true,
        orgScopeId: true,
        orgScope: {
          select: {
            unit: true,
            anaf: true,
            mador: true,
            team: true,
            orgCode: true,
          },
        },
      },
      orderBy: { email: 'asc' },
    }).then((users) => users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      mador: user.orgScope?.mador ?? null,
      team: user.orgScope?.team ?? null,
      orgScopeId: user.orgScopeId,
      orgCode: user.orgCode ?? user.orgScope?.orgCode ?? null,
      unit: user.orgScope?.unit ?? null,
      anaf: user.orgScope?.anaf ?? null,
    })));
  }

  async require(headerValue: string | undefined): Promise<CurrentUser> {
    const parsedId = uuidSchema.safeParse(headerValue);
    if (!parsedId.success) {
      throw new UnauthorizedException('יש לבחור משתמש הדגמה תקין');
    }

    const [user, access] = await Promise.all([
      db.user.findUnique({
        where: { id: parsedId.data },
        include: { orgScope: true },
      }),
      db.userAccessProfile.findFirst({ where: { userId: parsedId.data } }),
    ]);

    if (!user || !access) {
      throw new UnauthorizedException('המשתמש אינו קיים או חסר פרופיל הרשאות');
    }

    const accessProfile: AccessProfile = {
      ...access,
      accessUnitCode: access.accessUnitCode ?? null,
      canApproveShipments: Boolean(access.canApproveShipments),
    };

    return {
      id: user.id,
      email: user.email,
      role: accessProfile.role,
      orgScopeId: user.orgScopeId,
      mador: user.orgScope?.mador ?? null,
      access: accessProfile,
    };
  }
}
