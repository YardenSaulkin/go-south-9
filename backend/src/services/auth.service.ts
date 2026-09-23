import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgScopeLevel, UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { db } from '../lib/db.js';
import type { LoginInput, SignupInput } from '../auth/auth.schemas.js';

// The app identifies the caller by the `x-user-id` header (see
// CurrentUserService). Sign-up and login therefore return the user record, and
// the client sends its id on subsequent requests.
export interface AuthenticatedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  personalNumber: string | null;
  email: string;
  role: UserRole;
  orgScopeId: string | null;
  orgCode: string | null;
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    personalNumber: user.personalNumber,
    email: user.email,
    role: user.role,
    orgScopeId: user.orgScopeId,
    orgCode: user.orgCode,
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

    const orgCode = `${input.unit}${input.anaf}${input.mador}${input.team}`;

    const orgScope = await this.findOrCreateOrgScope(input.mador, orgCode);

    const user = await db.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        personalNumber: input.personalNumber,
        email: input.email,
        role: UserRole.normal,
        orgScopeId: orgScope.id,
        orgCode,
      },
    });

    return toAuthenticatedUser(user);
  }

  async login(input: LoginInput): Promise<AuthenticatedUser> {
    const user = await db.user.findUnique({
      where: { personalNumber: input.personalNumber },
    });

    // One message for both cases, so the response does not reveal which
    // personal numbers are registered.
    if (!user || user.email.toLowerCase() !== input.email) {
      throw new UnauthorizedException('מספר אישי או אימייל שגויים');
    }

    return toAuthenticatedUser(user);
  }

  // Users must belong to an org scope, otherwise the user_access_profiles view
  // resolves no mador and the operations endpoints reject them.
  private async findOrCreateOrgScope(mador: string, orgCode: string) {
    const existing = await db.orgScope.findFirst({ where: { orgCode } });
    if (existing) return existing;

    return db.orgScope.create({
      data: {
        scopeLevel: OrgScopeLevel.team,
        mador,
        orgCode,
      },
    });
  }
}
