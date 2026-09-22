import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgScopeLevel, UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { db } from '../lib/db.js';
import type { LoginInput, SignupInput } from '../auth/auth.schemas.js';

export interface AuthenticatedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  personalNumber: string | null;
  email: string;
  role: UserRole;
  unit: string | null;
  anaf: string | null;
  mador: string | null;
  team: string | null;
  orgScopeId: string | null;
  orgCode: string | null;
}

type UserWithOrgScope = Prisma.UserGetPayload<{ include: { orgScope: true } }>;

function toAuthenticatedUser(user: UserWithOrgScope): AuthenticatedUser {
  const organization = user.orgScope;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    personalNumber: user.personalNumber,
    email: user.email,
    role: user.role,
    unit: organization?.unit ?? null,
    anaf: organization?.anaf ?? null,
    mador: organization?.mador ?? null,
    team: organization?.team ?? null,
    orgScopeId: user.orgScopeId,
    orgCode: user.orgCode ?? organization?.orgCode ?? null,
  };
}

@Injectable()
export class AuthService {
  async signup(input: SignupInput): Promise<AuthenticatedUser> {
    const [existingByPersonalNumber, existingByEmail] = await Promise.all([
      db.user.findUnique({ where: { personalNumber: input.personalNumber } }),
      db.user.findFirst({
        where: { email: { equals: input.email, mode: 'insensitive' } },
      }),
    ]);

    if (existingByPersonalNumber) {
      throw new ConflictException('מספר אישי זה כבר רשום במערכת');
    }
    if (existingByEmail) {
      throw new ConflictException('כתובת אימייל זו כבר רשומה במערכת');
    }

    const orgScope = await this.findOrCreateOrgScope(input);
    const user = await db.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        personalNumber: input.personalNumber,
        email: input.email,
        role: UserRole.normal,
        orgScopeId: orgScope.id,
        orgCode: orgScope.orgCode,
      },
      include: { orgScope: true },
    });

    return toAuthenticatedUser(user);
  }

  async login(input: LoginInput): Promise<AuthenticatedUser> {
    const user = await db.user.findUnique({
      where: { personalNumber: input.personalNumber },
      include: { orgScope: true },
    });

    if (!user || user.email.toLowerCase() !== input.email) {
      throw new UnauthorizedException('מספר אישי או אימייל שגויים');
    }

    return toAuthenticatedUser(user);
  }

  private async findOrCreateOrgScope(input: SignupInput) {
    const existing = await db.orgScope.findFirst({
      where: {
        unit: input.unit,
        anaf: input.anaf,
        mador: input.mador,
        team: input.team,
      },
    });
    if (existing) return existing;

    return db.orgScope.create({
      data: {
        scopeLevel: OrgScopeLevel.team,
        unit: input.unit,
        anaf: input.anaf,
        mador: input.mador,
        team: input.team,
      },
    });
  }
}
