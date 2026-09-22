import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findExistingPackingUnit: vi.fn(),
  transaction: vi.fn(),
  findScope: vi.fn(),
  findRoomItems: vi.fn(),
  findDestination: vi.fn(),
  createDestination: vi.fn(),
  updateDestination: vi.fn(),
  createPackingUnit: vi.fn(),
  findCreatedPackingUnit: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    packingUnit: { findFirst: mocks.findExistingPackingUnit },
    $transaction: mocks.transaction,
  },
}));

import { PackingService } from './packing.service.js';

const scope = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  mador: '56',
  unit: '12',
  anaf: '34',
  team: '12345678',
  orgCode: '12345678',
};

const user = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'operator@example.com',
  role: UserRole.normal,
  orgScopeId: scope.id,
  orgCode: scope.orgCode,
  mador: scope.mador,
  access: {
    role: UserRole.normal,
    accessMador: scope.mador,
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

const existingDestination = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  destinationCode: 'D-00123',
  description: 'מחסן תקשוב',
  building: 'ב',
  floor: '3',
  room: '309',
  orgScopeId: scope.id,
  createdByUserId: user.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function input(destination: { mode: 'existing'; destinationId: string } | { mode: 'new'; description: string; building: string; floor: string; room: string }) {
  return {
    idempotencyKey: '123e4567-e89b-12d3-a456-426614174003',
    orgScopeId: scope.id,
    description: 'קרטון אישי - חדר 100',
    packingUnitType: 'personal_carton' as const,
    sourceRoomId: 'Room 100',
    destination,
    items: [],
  };
}

describe('packing destination persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findExistingPackingUnit.mockResolvedValue(null);
    mocks.findScope.mockResolvedValue(scope);
    mocks.findRoomItems.mockResolvedValue([
      { sourceDescription: 'מחסן תקשורת קומה ב׳', sourceMappingReportId: 'mapping-1' },
    ]);
    mocks.findDestination.mockResolvedValue(existingDestination);
    mocks.createDestination.mockResolvedValue(existingDestination);
    mocks.createEvent.mockResolvedValue({});

    const created = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      description: 'קרטון אישי - חדר 100',
      serialNumber: 1,
      packingUnitType: 'personal_carton',
      status: 'not_sent',
      orgScopeId: scope.id,
      sourceRoomId: 'Room 100',
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: existingDestination.destinationCode,
      destinationDescription: JSON.stringify({
        id: existingDestination.id,
        code: existingDestination.destinationCode,
        description: existingDestination.description,
        building: existingDestination.building,
        floor: existingDestination.floor,
        room: existingDestination.room,
      }),
      createdBy: { email: user.email },
      orgScope: scope,
      items: [],
    };
    mocks.createPackingUnit.mockResolvedValue(created);
    mocks.findCreatedPackingUnit.mockResolvedValue(created);

    mocks.transaction.mockImplementation(async (callback) => callback({
      orgScope: { findUnique: mocks.findScope },
      item: { findMany: mocks.findRoomItems },
      destination: {
        findUnique: mocks.findDestination,
        create: mocks.createDestination,
        update: mocks.updateDestination,
      },
      packingUnit: {
        create: mocks.createPackingUnit,
        findUniqueOrThrow: mocks.findCreatedPackingUnit,
      },
      operationEvent: { create: mocks.createEvent },
    }));
  });

  it('uses an existing destination without mutating it and snapshots the server-resolved source room', async () => {
    await new PackingService().create(user, input({ mode: 'existing', destinationId: existingDestination.id }));

    expect(mocks.findDestination).toHaveBeenCalledWith({ where: { id: existingDestination.id } });
    expect(mocks.updateDestination).not.toHaveBeenCalled();
    expect(mocks.createPackingUnit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceDescription: 'מחסן תקשורת קומה ב׳',
        destinationRoomId: existingDestination.destinationCode,
      }),
    }));
  });

  it('creates a new destination inside the same packing transaction', async () => {
    await new PackingService().create(user, input({
      mode: 'new',
      description: 'מחסן תקשוב',
      building: 'ב',
      floor: '3',
      room: '309',
    }));

    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.createDestination).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        description: 'מחסן תקשוב',
        orgScopeId: scope.id,
        createdByUserId: user.id,
      }),
    }));
    expect(mocks.createPackingUnit).toHaveBeenCalled();
  });
});
