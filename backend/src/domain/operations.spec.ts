import { UserRole } from '@prisma/client';
import {
  ItemStatus,
  PackingUnitStatus,
  PackingUnitType,
  ShipmentStatus,
} from '@prisma/client';
import { canAccessMador } from './permissions.js';
import {
  formatSerial,
  planQuantitySplit,
  summarizeQuantities,
} from './quantities.js';
import { summarizeReceiving } from './receiving.js';
import { mappingStatusFromProvenance } from './mapping.js';
import { createPackingUnitSchema } from './operations.schemas.js';
import {
  assertClaimSucceeded,
  assertPackingUnitCanVerify,
  assertPackingUnitTransition,
  assertShipmentCanVerify,
  assertShipmentTransition,
} from './status-transitions.js';

const logisticsAccess = {
  role: UserRole.normal,
  accessMador: 'מדור א',
  accessUnitCode: null,
  canCreateShipments: true,
  canCreatePackingUnits: true,
  canViewShipments: true,
  canViewPackingUnits: true,
  canViewGlobalShipmentsDashboard: false,
  canApproveShipments: false,
  dataVisibilityScope: 'mador',
};

describe('operational domain rules', () => {
  it('scopes a logistics user to their own mador', () => {
    expect(canAccessMador(logisticsAccess, 'מדור א')).toBe(true);
    expect(canAccessMador(logisticsAccess, 'מדור ב')).toBe(false);
    expect(
      canAccessMador(
        { ...logisticsAccess, role: UserRole.admin },
        'מדור ב',
      ),
    ).toBe(true);
  });

  it('allows only intentional shipment and packing-unit transitions', () => {
    expect(() =>
      assertShipmentTransition(ShipmentStatus.not_sent, ShipmentStatus.sent),
    ).not.toThrow();
    expect(() =>
      assertShipmentTransition(
        ShipmentStatus.not_sent,
        ShipmentStatus.verified,
      ),
    ).toThrow();
    expect(() =>
      assertPackingUnitTransition(
        PackingUnitStatus.in_transit,
        PackingUnitStatus.arrived_pending_verification,
      ),
    ).not.toThrow();
  });

  it('enforces parent verification guards', () => {
    expect(() =>
      assertPackingUnitCanVerify([ItemStatus.verified, ItemStatus.not_sent]),
    ).toThrow();
    expect(() =>
      assertPackingUnitCanVerify([ItemStatus.verified]),
    ).not.toThrow();
    expect(() =>
      assertPackingUnitCanVerify([], {
        packingUnitType: PackingUnitType.personal_carton,
      }),
    ).toThrow('קרטון אישי דורש אימות קבלה מפורש');
    expect(() =>
      assertPackingUnitCanVerify([], {
        packingUnitType: PackingUnitType.personal_carton,
        explicitEmptyUnitVerification: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertShipmentCanVerify([
        PackingUnitStatus.verified,
        PackingUnitStatus.in_transit,
      ]),
    ).toThrow();
  });

  it('splits item quantities without losing the remainder', () => {
    expect(planQuantitySplit(10, 4)).toEqual({
      selected: 4,
      remaining: 6,
      isFullQuantity: false,
    });
    expect(() => planQuantitySplit(10, 11)).toThrow();
  });

  it('rejects a stale or double item claim', () => {
    expect(() => assertClaimSucceeded(1)).not.toThrow();
    expect(() => assertClaimSucceeded(0)).toThrow();
  });

  it('formats the DB-backed serial for physical labels', () => {
    expect(formatSerial(1)).toBe('00001');
    expect(formatSerial(532)).toBe('00532');
  });

  it('marks mapping from provenance, independently of eligible item count', () => {
    expect(mappingStatusFromProvenance('room-1', 2)).toEqual({
      roomId: 'room-1',
      exists: true,
      completed: true,
      source: 'mapping_report_provenance',
    });
    expect(mappingStatusFromProvenance('room-2', 0).exists).toBe(false);
    expect(mappingStatusFromProvenance(undefined, 0).source).toBe('not_selected');
  });

  it('allows a personal carton without Items and requires Items otherwise', () => {
    const base = {
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      orgScopeId: '123e4567-e89b-12d3-a456-426614174001',
      description: 'קרטון אישי - חדר 1',
      sourceRoomId: 'חדר 1',
      destination: {
        mode: 'new' as const,
        description: 'יעד בדיקה',
        building: 'א',
        floor: '1',
        room: '2',
      },
    };

    expect(
      createPackingUnitSchema.safeParse({
        ...base,
        packingUnitType: PackingUnitType.personal_carton,
        items: [],
      }).success,
    ).toBe(true);
    expect(
      createPackingUnitSchema.safeParse({
        ...base,
        packingUnitType: PackingUnitType.personal_carton,
        items: [{ itemId: '123e4567-e89b-12d3-a456-426614174002', quantity: 1 }],
      }).success,
    ).toBe(false);
    const withOptionalDescriptions = createPackingUnitSchema.safeParse({
      ...base,
      description: 'קרטון אישי עם ציוד אישי',
      sourceDescription: 'מדף עליון ליד הכניסה',
      destination: {
        ...base.destination,
        description: 'להניח בחדר הקליטה',
      },
      packingUnitType: PackingUnitType.personal_carton,
      items: [],
    });
    expect(withOptionalDescriptions.success).toBe(true);
    expect(
      createPackingUnitSchema.safeParse({
        ...base,
        description: '',
        packingUnitType: PackingUnitType.personal_carton,
        items: [],
      }).error?.issues.some(
        ({ message }) => message === 'יש להזין פירוט עבור קרטון אישי',
      ),
    ).toBe(true);
    expect(
      createPackingUnitSchema.safeParse({
        ...base,
        packingUnitType: PackingUnitType.professional_carton,
        items: [],
      }).success,
    ).toBe(false);
  });

  it('computes receiving discrepancies from explicit confirmations', () => {
    expect(summarizeReceiving(['a', 'b', 'c'], ['a', 'c'])).toEqual({
      expectedCount: 3,
      receivedCount: 2,
      missingCount: 1,
      arrivedIds: ['a', 'c'],
      missingIds: ['b'],
    });
    expect(() => summarizeReceiving(['a'], ['b'])).toThrow();
  });

  it('preserves distribution shortages and rejects excess', () => {
    expect(summarizeQuantities(10, 7)).toEqual({
      expected: 10,
      actual: 7,
      missing: 3,
    });
    expect(() => summarizeQuantities(10, 11)).toThrow();
  });
});
