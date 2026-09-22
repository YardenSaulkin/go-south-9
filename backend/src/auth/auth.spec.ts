import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  createUser: vi.fn(),
  findScope: vi.fn(),
  createScope: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    user: {
      findUnique: databaseMocks.findUnique,
      findFirst: databaseMocks.findFirst,
      create: databaseMocks.createUser,
    },
    orgScope: {
      findFirst: databaseMocks.findScope,
      create: databaseMocks.createScope,
    },
  },
}));

import { loginSchema } from './auth.schemas.js';
import { AuthService } from '../services/auth.service.js';
import type { OrgHierarchyService } from '../services/org-hierarchy.service.js';

const authService = () => new AuthService({} as OrgHierarchyService);

const persistedUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'operator@example.com',
  firstName: 'דנה',
  lastName: 'כהן',
  personalNumber: '1234567',
  role: UserRole.normal,
  orgCode: '12345678',
  orgScopeId: '123e4567-e89b-12d3-a456-426614174001',
  createdByUserId: null,
  createdAt: new Date('2026-09-22T00:00:00.000Z'),
  updatedAt: new Date('2026-09-22T00:00:00.000Z'),
  orgScope: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    unit: 'יחידה א',
    anaf: 'ענף א',
    mador: 'מדור א',
    team: 'צוות א',
    orgCode: '12345678',
  },
};

describe('authentication regression', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes and validates the login credentials', () => {
    expect(
      loginSchema.parse({
        personalNumber: ' 1234567 ',
        email: ' OPERATOR@EXAMPLE.COM ',
      }),
    ).toEqual({
      personalNumber: '1234567',
      email: 'operator@example.com',
    });
  });

  it.each([UserRole.normal, UserRole.poc, UserRole.admin])(
    'returns a %s user using the canonical user orgCode',
    async (role) => {
      databaseMocks.findUnique.mockResolvedValue({ ...persistedUser, role });

      const result = await authService().login({
        personalNumber: '1234567',
        email: 'operator@example.com',
      });

      expect(databaseMocks.findUnique).toHaveBeenCalledWith({
        where: { personalNumber: '1234567' },
      });
      expect(result).toMatchObject({
        id: persistedUser.id,
        personalNumber: '1234567',
        email: 'operator@example.com',
        role,
        orgCode: '12345678',
        orgScopeId: persistedUser.orgScopeId,
      });
    },
  );

  it('returns one generic error for unknown or mismatched credentials', async () => {
    databaseMocks.findUnique.mockResolvedValue(persistedUser);

    await expect(
      authService().login({
        personalNumber: '1234567',
        email: 'wrong@example.com',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<UnauthorizedException>>({
        message: 'מספר אישי או אימייל שגויים',
      }),
    );
  });
});
