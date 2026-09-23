import { ItemStatus, PackingUnitStatus, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findExistingPackingUnit: vi.fn(),
  transaction: vi.fn(),
  findScope: vi.fn(),
  findItems: vi.fn(),
  findItem: vi.fn(),
  updateItems: vi.fn(),
  createItem: vi.fn(),
  findPackingUnits: vi.fn(),
  createPackingUnit: vi.fn(),
  findCreatedPackingUnit: vi.fn(),
  findCommittedPackingUnit: vi.fn(),
  findShipments: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    orgScope: { findUnique: mocks.findScope },
    item: { findMany: mocks.findItems },
    shipment: { findMany: mocks.findShipments },
    packingUnit: {
      findFirst: mocks.findExistingPackingUnit,
      findMany: mocks.findPackingUnits,
      findUniqueOrThrow: mocks.findCommittedPackingUnit,
    },
    $transaction: mocks.transaction,
  },
}));

import type { CurrentUser } from '../auth/current-user.service.js';
import { PackingService } from './packing.service.js';

const scope = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  scopeLevel: 'team',
  mador: '56',
  description: null,
  orgCode: '12345678',
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

const user: CurrentUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'operator@example.com',
  firstName: 'דנה',
  lastName: 'כהן',
  personalNumber: '1234567',
  role: UserRole.normal,
  orgScopeId: scope.id,
  orgCode: scope.orgCode,
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
    dataVisibilityScope: scope.mador,
  },
};

const baseInput = {
  idempotencyKey: '123e4567-e89b-12d3-a456-426614174003',
  orgScopeId: scope.id,
  description: 'ציוד למעבר',
  sourceRoomId: 'Room 100',
};

const collidingDestinationId = 'לשכה דרומית';
const cleanDestinationDescription = 'בניין מפקדה דרום, חדר 101';
const legacyJsonDestinationDescription = JSON.stringify({
  building: 'בניין מפקדה דרום',
  floor: 'קומה 1',
  room: 'לשכה 101',
  roomId: 'לשכה 101',
});

function configureTransaction(
  destinationRows: Array<{
    destinationRoomId: string;
    destinationDescription: string | null;
  }> = [],
  packingUnitDestinationRows: Array<{
    destinationRoomId: string;
    destinationDescription: string | null;
  }> = [],
) {
  mocks.findItems.mockImplementation((args: { select?: Record<string, boolean> }) =>
    args.select?.sourceMappingReportId
      ? [
          {
            sourceDescription: 'מחסן תקשורת קומה ב׳',
            sourceMappingReportId: 'mapping-1',
          },
        ]
      : destinationRows,
  );
  mocks.findPackingUnits.mockResolvedValue(packingUnitDestinationRows);
  mocks.findShipments.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (callback) =>
    callback(transactionClient()),
  );
}

function transactionClient() {
  return {
    orgScope: { findUnique: mocks.findScope },
    item: {
      findMany: mocks.findItems,
      findUnique: mocks.findItem,
      updateMany: mocks.updateItems,
      create: mocks.createItem,
    },
    packingUnit: {
      findMany: mocks.findPackingUnits,
      create: mocks.createPackingUnit,
      // This represents the expired transaction handle that caused P2028.
      // The production service must never hydrate its final response through it.
      findUniqueOrThrow: mocks.findCreatedPackingUnit,
    },
    shipment: { findMany: mocks.findShipments },
    operationEvent: { create: mocks.createEvent },
  };
}

describe('packing destination persistence and transactional guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findExistingPackingUnit.mockResolvedValue(null);
    mocks.findScope.mockResolvedValue(scope);
    mocks.updateItems.mockResolvedValue({ count: 1 });
    mocks.createEvent.mockResolvedValue({});
    configureTransaction();

    const created = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      description: baseInput.description,
      shipmentId: null,
      serialNumber: 1,
      packingUnitType: 'personal_carton',
      status: PackingUnitStatus.not_sent,
      orgScopeId: scope.id,
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: 'DEST-NEW',
      destinationDescription: 'בניין א, קומה 1, חדר 2 — יעד בדיקה',
      ownerUserId: user.id,
      createdByUserId: user.id,
      idempotencyKey: baseInput.idempotencyKey,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personalNumber: user.personalNumber,
      },
      orgScope: scope,
      items: [],
    };
    mocks.createPackingUnit.mockResolvedValue(created);
    mocks.findCreatedPackingUnit.mockResolvedValue(created);
    mocks.findCommittedPackingUnit.mockResolvedValue(created);
  });

  it('hydrates the success response only after the transaction commits', async () => {
    configureTransaction([
      { destinationRoomId: 'DEST-EXISTING', destinationDescription: 'יעד קיים' },
    ]);
    let committed = false;
    const committedUnit = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      description: baseInput.description,
      serialNumber: 1,
      packingUnitType: 'personal_carton',
      status: PackingUnitStatus.not_sent,
      orgScopeId: scope.id,
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: 'DEST-EXISTING',
      destinationDescription: 'יעד קיים',
      createdBy: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personalNumber: user.personalNumber,
      },
      orgScope: scope,
      items: [],
    };
    mocks.createPackingUnit.mockResolvedValue({ id: committedUnit.id });
    mocks.findCreatedPackingUnit.mockRejectedValue(
      new Error('P2028: Transaction not found / old closed transaction'),
    );
    mocks.findCommittedPackingUnit.mockImplementation(async () => {
      if (!committed) {
        throw new Error('final hydration happened before commit');
      }
      return committedUnit;
    });
    mocks.transaction.mockImplementation(async (callback) => {
      const packingUnitId = await callback(transactionClient());
      committed = true;
      return packingUnitId;
    });

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'personal_carton',
        destination: { mode: 'existing', destinationId: 'DEST-EXISTING' },
        items: [],
      }),
    ).resolves.toMatchObject({
      packingUnit: { id: committedUnit.id },
      destination: { id: 'DEST-EXISTING' },
    });

    expect(mocks.findCreatedPackingUnit).not.toHaveBeenCalled();
    expect(mocks.findCommittedPackingUnit).toHaveBeenCalledWith({
      where: { id: committedUnit.id },
      include: { items: true, createdBy: true, orgScope: true },
    });
  });

  it('creates a personal carton with no Items and persists only live snapshot fields', async () => {
    const response = await new PackingService().create(user, {
      ...baseInput,
      packingUnitType: 'personal_carton',
      destination: {
        mode: 'new',
        destinationId: 'DEST-NEW',
        description: 'יעד בדיקה',
        building: 'א',
        floor: '1',
        room: '2',
      },
      items: [],
    });

    expect(mocks.createPackingUnit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PackingUnitStatus.not_sent,
        sourceDescription: 'מחסן תקשורת קומה ב׳',
        destinationRoomId: 'DEST-NEW',
        destinationDescription: 'בניין א, קומה 1, חדר 2 — יעד בדיקה',
      }),
    });
    const createData = mocks.createPackingUnit.mock.calls[0]?.[0]?.data;
    expect(createData).not.toHaveProperty('destinationBuilding');
    expect(createData).not.toHaveProperty('sourceRoomResponsibleName');
    expect(response.responsiblePeople).toMatchObject({ mador: null, room: null });
  });

  it('rejects a duplicate new destination ID with the domain conflict', async () => {
    configureTransaction([
      { destinationRoomId: 'dest-used', destinationDescription: 'יעד קיים' },
    ]);

    const promise = new PackingService().create(user, {
      ...baseInput,
      packingUnitType: 'personal_carton',
      destination: {
        mode: 'new',
        destinationId: ' DEST-USED ',
        description: 'יעד אחר',
        building: 'ב',
        floor: '2',
        room: '3',
      },
      items: [],
    });

    await expect(promise).rejects.toMatchObject({
      status: 409,
      message: 'יעד עם מזהה זה כבר קיים',
    });
    expect(mocks.createPackingUnit).not.toHaveBeenCalled();
  });

  it('rejects a persisted normalized destination ID even without a description', async () => {
    configureTransaction([
      { destinationRoomId: 'dest-id-only', destinationDescription: null },
    ]);

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'personal_carton',
        destination: {
          mode: 'new',
          destinationId: ' DEST-ID-ONLY ',
          description: 'יעד חדש',
          building: 'ב',
          floor: '2',
          room: '3',
        },
        items: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'יעד עם מזהה זה כבר קיים',
    });
    expect(mocks.createPackingUnit).not.toHaveBeenCalled();
  });

  it('does not lose an exact duplicate behind the UI catalog result limit', async () => {
    configureTransaction([
      ...Array.from({ length: 21 }, (_, index) => ({
        destinationRoomId: `DEST-${String(index).padStart(2, '0')}-EXACT-TARGET`,
        destinationDescription: `יעד ${index}`,
      })),
      {
        destinationRoomId: 'EXACT-TARGET',
        destinationDescription: 'היעד המדויק',
      },
    ]);

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'personal_carton',
        destination: {
          mode: 'new',
          destinationId: ' exact-target ',
          description: 'יעד חדש',
          building: 'ב',
          floor: '2',
          room: '3',
        },
        items: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'יעד עם מזהה זה כבר קיים',
    });
    expect(mocks.createPackingUnit).not.toHaveBeenCalled();
  });

  it('allows an existing destination with historical description collisions', async () => {
    configureTransaction(
      [
        {
          destinationRoomId: collidingDestinationId,
          destinationDescription: cleanDestinationDescription,
        },
      ],
      [
        {
          destinationRoomId: collidingDestinationId,
          destinationDescription: legacyJsonDestinationDescription,
        },
      ],
    );

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'personal_carton',
        destination: {
          mode: 'existing',
          destinationId: ` ${collidingDestinationId} `,
        },
        items: [],
      }),
    ).resolves.toBeDefined();

    expect(mocks.createPackingUnit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        destinationRoomId: collidingDestinationId,
        destinationDescription: cleanDestinationDescription,
      }),
    });
  });

  it('rechecks and assigns an eligible non-personal Item transactionally', async () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174005',
      description: 'מחשב',
      packingUnitId: null,
      status: ItemStatus.not_sent,
      sourceMappingReportId: 'mapping-1',
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: null,
      destinationDescription: null,
      orgScopeId: scope.id,
      ownerUserId: null,
      createdByUserId: null,
      quantity: 1,
    };
    mocks.findItem.mockResolvedValue(item);
    const createdWithItem = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      description: baseInput.description,
      serialNumber: 2,
      packingUnitType: 'professional_carton',
      status: PackingUnitStatus.not_sent,
      orgScopeId: scope.id,
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: item.sourceDescription,
      destinationRoomId: 'DEST-EXISTING',
      destinationDescription: 'יעד קיים',
      createdBy: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personalNumber: user.personalNumber,
      },
      orgScope: scope,
      items: [{ ...item, status: ItemStatus.assigned_to_packing_unit }],
    };
    mocks.findCreatedPackingUnit.mockResolvedValue(createdWithItem);
    configureTransaction([
      {
        destinationRoomId: 'DEST-EXISTING',
        destinationDescription: 'יעד קיים',
      },
    ]);

    await new PackingService().create(user, {
      ...baseInput,
      packingUnitType: 'professional_carton',
      destination: { mode: 'existing', destinationId: 'DEST-EXISTING' },
      items: [{ itemId: item.id, quantity: 1 }],
    });

    expect(mocks.updateItems).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: item.id,
        packingUnitId: null,
        status: ItemStatus.not_sent,
      }),
      data: expect.objectContaining({
        status: ItemStatus.assigned_to_packing_unit,
      }),
    });
  });

  it('commits Item assignments before the post-transaction success hydration', async () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174005',
      description: 'מחשב',
      packingUnitId: null,
      status: ItemStatus.not_sent,
      sourceMappingReportId: 'mapping-1',
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: null,
      destinationDescription: null,
      orgScopeId: scope.id,
      ownerUserId: null,
      createdByUserId: null,
      quantity: 1,
    };
    const createdId = '123e4567-e89b-12d3-a456-426614174004';
    const committedAssignments: string[] = [];
    const stagedAssignments: string[] = [];
    configureTransaction([
      { destinationRoomId: 'DEST-EXISTING', destinationDescription: 'יעד קיים' },
    ]);
    mocks.findItem.mockResolvedValue(item);
    mocks.createPackingUnit.mockResolvedValue({ id: createdId });
    mocks.findCreatedPackingUnit.mockRejectedValue(
      new Error('P2028: hydration must not use the transaction client'),
    );
    mocks.findCommittedPackingUnit.mockImplementation(async () => {
      expect(committedAssignments).toEqual([item.id]);
      return {
        id: createdId,
        description: baseInput.description,
        serialNumber: 2,
        packingUnitType: 'professional_carton',
        status: PackingUnitStatus.not_sent,
        orgScopeId: scope.id,
        sourceRoomId: baseInput.sourceRoomId,
        sourceDescription: item.sourceDescription,
        destinationRoomId: 'DEST-EXISTING',
        destinationDescription: 'יעד קיים',
        createdBy: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          personalNumber: user.personalNumber,
        },
        orgScope: scope,
        items: [{ ...item, packingUnitId: createdId, status: ItemStatus.assigned_to_packing_unit }],
      };
    });
    mocks.transaction.mockImplementation(async (callback) => {
      const tx = transactionClient();
      tx.item.updateMany = vi.fn(async () => {
        stagedAssignments.push(item.id);
        return { count: 1 };
      });
      const packingUnitId = await callback(tx);
      committedAssignments.push(...stagedAssignments);
      return packingUnitId;
    });

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'professional_carton',
        destination: { mode: 'existing', destinationId: 'DEST-EXISTING' },
        items: [{ itemId: item.id, quantity: 1 }],
      }),
    ).resolves.toMatchObject({
      packingUnit: { id: createdId, itemCount: 1 },
    });
    expect(mocks.findCreatedPackingUnit).not.toHaveBeenCalled();
  });

  it('rolls back staged PackingUnit and Item changes when a transactional write fails', async () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174005',
      description: 'מחשב',
      packingUnitId: null,
      status: ItemStatus.not_sent,
      sourceMappingReportId: 'mapping-1',
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: null,
      destinationDescription: null,
      orgScopeId: scope.id,
      ownerUserId: null,
      createdByUserId: null,
      quantity: 1,
    };
    const staged: string[] = [];
    const committed: string[] = [];
    configureTransaction([
      { destinationRoomId: 'DEST-EXISTING', destinationDescription: 'יעד קיים' },
    ]);
    mocks.findItem.mockResolvedValue(item);
    mocks.createPackingUnit.mockImplementation(async () => {
      staged.push('packing-unit');
      return { id: '123e4567-e89b-12d3-a456-426614174004' };
    });
    mocks.createEvent.mockRejectedValue(new Error('event write failed'));
    mocks.transaction.mockImplementation(async (callback) => {
      const tx = transactionClient();
      tx.item.updateMany = vi.fn(async () => {
        staged.push('item-assignment');
        return { count: 1 };
      });
      try {
        const result = await callback(tx);
        committed.push(...staged);
        return result;
      } catch (error) {
        staged.length = 0;
        throw error;
      }
    });

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'professional_carton',
        destination: { mode: 'existing', destinationId: 'DEST-EXISTING' },
        items: [{ itemId: item.id, quantity: 1 }],
      }),
    ).rejects.toThrow('event write failed');
    expect(staged).toEqual([]);
    expect(committed).toEqual([]);
    expect(mocks.findCommittedPackingUnit).not.toHaveBeenCalled();
  });

  it('returns the same committed result for an idempotent retry without another transaction', async () => {
    configureTransaction([
      { destinationRoomId: 'DEST-EXISTING', destinationDescription: 'יעד קיים' },
    ]);
    const createdId = '123e4567-e89b-12d3-a456-426614174004';
    const committedUnit = {
      id: createdId,
      description: baseInput.description,
      serialNumber: 1,
      packingUnitType: 'personal_carton',
      status: PackingUnitStatus.not_sent,
      orgScopeId: scope.id,
      sourceRoomId: baseInput.sourceRoomId,
      sourceDescription: 'מחסן תקשורת קומה ב׳',
      destinationRoomId: 'DEST-EXISTING',
      destinationDescription: 'יעד קיים',
      createdByUserId: user.id,
      createdBy: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personalNumber: user.personalNumber,
      },
      orgScope: scope,
      items: [],
    };
    let persisted: typeof committedUnit | null = null;
    mocks.findExistingPackingUnit.mockImplementation(async () => persisted);
    mocks.createPackingUnit.mockResolvedValue({ id: createdId });
    mocks.findCreatedPackingUnit.mockRejectedValue(
      new Error('P2028: hydration must not use the transaction client'),
    );
    mocks.findCommittedPackingUnit.mockImplementation(async () => persisted);
    mocks.transaction.mockImplementation(async (callback) => {
      const packingUnitId = await callback(transactionClient());
      persisted = committedUnit;
      return packingUnitId;
    });
    const input = {
      ...baseInput,
      packingUnitType: 'personal_carton' as const,
      destination: { mode: 'existing' as const, destinationId: 'DEST-EXISTING' },
      items: [],
    };
    const service = new PackingService();

    const first = await service.create(user, input);
    const retry = await service.create(user, input);

    expect(retry).toEqual(first);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createPackingUnit).toHaveBeenCalledTimes(1);
    expect(mocks.findCommittedPackingUnit).toHaveBeenCalledTimes(1);
  });

  it('rejects personal Items and non-personal empty selections before writing', async () => {
    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'personal_carton',
        destination: { mode: 'existing', destinationId: 'DEST-1' },
        items: [
          {
            itemId: '123e4567-e89b-12d3-a456-426614174005',
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('קרטון אישי אינו כולל פריטים');

    await expect(
      new PackingService().create(user, {
        ...baseInput,
        packingUnitType: 'bulk',
        destination: { mode: 'existing', destinationId: 'DEST-1' },
        items: [],
      }),
    ).rejects.toThrow('יש לבחור לפחות פריט אחד');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
