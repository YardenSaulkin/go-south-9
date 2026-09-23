import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findScope: vi.fn(),
  findItems: vi.fn(),
  findPackingUnits: vi.fn(),
  findShipments: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    orgScope: { findUnique: mocks.findScope },
    item: { findMany: mocks.findItems },
    packingUnit: { findMany: mocks.findPackingUnits },
    shipment: { findMany: mocks.findShipments },
  },
}));

import type { CurrentUser } from '../auth/current-user.service.js';
import {
  DestinationService,
  normalizeDestinationRows,
} from './destination.service.js';

const scopeId = '123e4567-e89b-12d3-a456-426614174001';
const destinationId = 'לשכה דרומית';
const cleanDestinationDescription = 'בניין מפקדה דרום, חדר 101';
const legacyJsonDestinationDescription = JSON.stringify({
  building: 'בניין מפקדה דרום',
  floor: 'קומה 1',
  room: 'לשכה 101',
  roomId: 'לשכה 101',
});
const user: CurrentUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'operator@example.com',
  firstName: 'דנה',
  lastName: 'כהן',
  personalNumber: '1234567',
  role: UserRole.normal,
  orgScopeId: scopeId,
  orgCode: '12345678',
  access: {
    role: UserRole.normal,
    accessMador: '56',
    accessUnitCode: null,
    canCreatePackingUnits: true,
    canCreateShipments: true,
    canViewPackingUnits: true,
    canViewShipments: true,
    canViewGlobalShipmentsDashboard: false,
    canApproveShipments: false,
    dataVisibilityScope: '56',
  },
};

describe('destination snapshot catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findScope.mockResolvedValue({
      id: scopeId,
      mador: '56',
      orgCode: '12345678',
    });
    mocks.findItems.mockResolvedValue([
      { destinationRoomId: ' DEST-1 ', destinationDescription: 'יעד ב' },
    ]);
    mocks.findPackingUnits.mockResolvedValue([
      { destinationRoomId: 'dest-1', destinationDescription: 'יעד א' },
    ]);
    mocks.findShipments.mockResolvedValue([
      { destinationRoomId: 'DEST-2', destinationDescription: 'יעד שני' },
    ]);
  });

  it('normalizes by operational ID and reports deterministic legacy collisions', () => {
    expect(
      normalizeDestinationRows([
        { destinationRoomId: ' DEST-1 ', destinationDescription: 'יעד ב' },
        { destinationRoomId: 'dest-1', destinationDescription: 'יעד א' },
        { destinationRoomId: '', destinationDescription: 'ללא מזהה' },
        { destinationRoomId: 'DEST-3', destinationDescription: ' ' },
      ]),
    ).toEqual([
      {
        id: 'dest-1',
        description: 'יעד א',
        hasHistoricalDescriptionCollision: true,
      },
    ]);
  });

  it('deduplicates colliding snapshots and prefers clean human-readable text', () => {
    const result = normalizeDestinationRows([
      {
        destinationRoomId: ` ${destinationId} `,
        destinationDescription: cleanDestinationDescription,
      },
      {
        destinationRoomId: destinationId,
        destinationDescription: legacyJsonDestinationDescription,
      },
    ]);

    expect(result).toEqual([
      {
        id: destinationId,
        description: cleanDestinationDescription,
        hasHistoricalDescriptionCollision: true,
      },
    ]);
    expect(result[0]?.description).not.toContain('{');
    expect(result[0]?.description).not.toContain('"building"');
  });

  it('converts a legacy JSON-only snapshot to human-readable Hebrew text', () => {
    const result = normalizeDestinationRows([
      {
        destinationRoomId: destinationId,
        destinationDescription: legacyJsonDestinationDescription,
      },
    ]);

    expect(result).toEqual([
      {
        id: destinationId,
        description: 'בניין מפקדה דרום, קומה 1, לשכה 101',
      },
    ]);
    expect(result[0]?.description).not.toContain('{');
    expect(result[0]?.description).not.toContain('"roomId"');
  });

  it('never returns malformed JSON-looking snapshots as display text', () => {
    expect(
      normalizeDestinationRows([
        {
          destinationRoomId: destinationId,
          destinationDescription: '{"building":"בניין מפקדה דרום"',
        },
      ]),
    ).toEqual([]);
  });

  it('ranks source-room-associated destinations first without filtering others', () => {
    const result = normalizeDestinationRows(
      [
        {
          destinationRoomId: 'DEST-OTHER',
          destinationDescription: 'יעד כללי',
          sourceRoomId: 'חדר אחר',
        },
        {
          destinationRoomId: 'DEST-ROOM',
          destinationDescription: 'יעד מועדף',
          sourceRoomId: 'לשכת מפקד',
        },
      ],
      'לשכת מפקד',
    );

    expect(result.map((destination) => destination.id)).toEqual([
      'DEST-ROOM',
      'DEST-OTHER',
    ]);
  });

  it('searches real snapshots from Items, PackingUnits, and Shipments', async () => {
    const result = await new DestinationService().search(user, scopeId, 'dest');

    expect(result).toEqual([
      {
        id: 'dest-1',
        description: 'יעד א',
        hasHistoricalDescriptionCollision: true,
      },
      { id: 'DEST-2', description: 'יעד שני' },
    ]);
    expect(mocks.findItems).toHaveBeenCalledOnce();
    expect(mocks.findPackingUnits).toHaveBeenCalledOnce();
    expect(mocks.findShipments).toHaveBeenCalledOnce();
  });

  it('searches historical JSON text but returns the full canonical collision entry', async () => {
    mocks.findItems.mockResolvedValue([
      {
        destinationRoomId: destinationId,
        destinationDescription: cleanDestinationDescription,
      },
    ]);
    mocks.findPackingUnits.mockResolvedValue([
      {
        destinationRoomId: destinationId,
        destinationDescription: legacyJsonDestinationDescription,
      },
    ]);
    mocks.findShipments.mockResolvedValue([]);

    await expect(
      new DestinationService().search(user, scopeId, 'קומה 1'),
    ).resolves.toEqual([
      {
        id: destinationId,
        description: cleanDestinationDescription,
        hasHistoricalDescriptionCollision: true,
      },
    ]);
  });
});
