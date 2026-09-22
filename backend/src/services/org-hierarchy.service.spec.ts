import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrgHierarchyService } from './org-hierarchy.service.js';
import { OrgHierarchyLevel } from '@prisma/client';

// Mock the db module
vi.mock('../lib/db.js', () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    orgHierarchyMapping: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { db } from '../lib/db.js';
const mockDb = db as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  orgHierarchyMapping: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockTx = {
  orgHierarchyMapping: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

describe('OrgHierarchyService.getOrCreateCode', () => {
  let service: OrgHierarchyService;

  beforeEach(() => {
    service = new OrgHierarchyService();
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
  });

  it('returns existing code if present', async () => {
    mockTx.orgHierarchyMapping.findFirst.mockResolvedValueOnce({ code: '03' });
    const code = await service.getOrCreateCode(OrgHierarchyLevel.unit, 'חיל האוויר');
    expect(code).toBe('03');
    expect(mockTx.orgHierarchyMapping.create).not.toHaveBeenCalled();
  });

  it('creates code 01 when no entries exist for the level', async () => {
    mockTx.orgHierarchyMapping.findFirst
      .mockResolvedValueOnce(null)  // no existing entry
      .mockResolvedValueOnce(null); // no max entry
    mockTx.orgHierarchyMapping.create.mockResolvedValueOnce({ code: '01' });
    const code = await service.getOrCreateCode(OrgHierarchyLevel.unit, 'חיל האוויר');
    expect(code).toBe('01');
    expect(mockTx.orgHierarchyMapping.create).toHaveBeenCalledWith({
      data: { level: OrgHierarchyLevel.unit, textValue: 'חיל האוויר', code: '01' },
    });
  });

  it('increments from max code', async () => {
    mockTx.orgHierarchyMapping.findFirst
      .mockResolvedValueOnce(null)         // no existing entry
      .mockResolvedValueOnce({ code: '04' }); // max is 04
    mockTx.orgHierarchyMapping.create.mockResolvedValueOnce({ code: '05' });
    const code = await service.getOrCreateCode(OrgHierarchyLevel.unit, 'חיל הים');
    expect(code).toBe('05');
  });
});

describe('OrgHierarchyService.resolveOrgCode', () => {
  let service: OrgHierarchyService;

  beforeEach(() => {
    service = new OrgHierarchyService();
    vi.clearAllMocks();
  });

  it('returns null for invalid length', async () => {
    const result = await service.resolveOrgCode('123');
    expect(result).toBeNull();
  });

  it('resolves all four levels', async () => {
    mockDb.orgHierarchyMapping.findFirst
      .mockResolvedValueOnce({ textValue: 'חיל האוויר' })
      .mockResolvedValueOnce({ textValue: 'טייסת' })
      .mockResolvedValueOnce({ textValue: 'לוגיסטיקה' })
      .mockResolvedValueOnce({ textValue: 'צוות א' });

    const result = await service.resolveOrgCode('01020304');
    expect(result).toEqual({
      unit: 'חיל האוויר',
      anaf: 'טייסת',
      mador: 'לוגיסטיקה',
      team: 'צוות א',
    });
  });
});
