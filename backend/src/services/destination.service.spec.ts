import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
  findScope: vi.fn(),
  findDestinations: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    orgScope: { findUnique: databaseMocks.findScope },
    destination: { findMany: databaseMocks.findDestinations },
  },
}));

import { DestinationService } from './destination.service.js';

const user = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'operator@example.com',
  role: UserRole.normal,
  orgScopeId: '123e4567-e89b-12d3-a456-426614174001',
  mador: '56',
  access: {
    role: UserRole.normal,
    accessMador: '56',
    accessUnitCode: null,
    canCreatePackingUnits: true,
    canCreateShipments: false,
    canViewPackingUnits: true,
    canViewShipments: false,
    canViewGlobalShipmentsDashboard: false,
    canApproveShipments: false,
    dataVisibilityScope: 'mador',
  },
};

describe('destination catalog search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.findScope.mockResolvedValue({
      id: user.orgScopeId,
      mador: '56',
    });
    databaseMocks.findDestinations.mockResolvedValue([]);
  });

  it('searches the authorized scope by destination code or description with a bounded result set', async () => {
    await new DestinationService().search(user, user.orgScopeId, 'D-1024');

    expect(databaseMocks.findDestinations).toHaveBeenCalledWith({
      where: {
        orgScopeId: user.orgScopeId,
        OR: [
          { destinationCode: { contains: 'D-1024', mode: 'insensitive' } },
          { description: { contains: 'D-1024', mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { destinationCode: 'asc' },
    });
  });
});
