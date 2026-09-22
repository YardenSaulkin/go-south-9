import { UserRole } from '@prisma/client';
import { ItemStatus, PackingUnitStatus, ShipmentStatus } from '@prisma/client';
import { canAccessMador } from './permissions.js';
import {
  formatSerial,
  planQuantitySplit,
  summarizeQuantities,
} from './quantities.js';
import { summarizeReceiving } from './receiving.js';
import {
  assertClaimSucceeded,
  assertPackingUnitCanVerify,
  assertPackingUnitTransition,
  assertShipmentCanVerify,
  assertShipmentTransition,
} from './status-transitions.js';

const logisticsAccess = {
  role: UserRole.logistics_user,
  accessMador: 'מדור א',
  canCreateShipments: true,
  canCreatePackingUnits: true,
  canViewShipments: true,
  canViewPackingUnits: true,
  canViewGlobalShipmentsDashboard: false,
  dataVisibilityScope: 'mador',
};

describe('operational domain rules', () => {
  it('scopes a logistics user to their own mador', () => {
    expect(canAccessMador(logisticsAccess, 'מדור א')).toBe(true);
    expect(canAccessMador(logisticsAccess, 'מדור ב')).toBe(false);
    expect(
      canAccessMador(
        { ...logisticsAccess, role: UserRole.super_user },
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
