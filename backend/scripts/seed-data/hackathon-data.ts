import type {
  ItemStatus,
  PackingUnitStatus,
  PackingUnitType,
  ShipmentStatus,
  TransportType,
} from '@prisma/client';

export const SEED_NAME = 'HACK-SEED-DATA-02';
export const SEED_TIMESTAMP = new Date('2026-09-23T08:00:00.000Z');

export type MovementScenario = 'A' | 'B' | 'C' | 'D';
export type OwnerSlot = 'none' | 'secondary';

export interface OrgSeed { id: string; unit: string; anaf: string; mador: string; team: string; orgCode: string; description: string; }
export interface RoomSeed { id: string; description: string; orgScopeId: string; mappingReportId: string | null; }
export interface DestinationSeed { id: string; description: string; building: string; floor: string; room: string; orgScopeId: string; }
export interface ItemSeed {
  id: string; description: string; packingUnitId: string | null; status: ItemStatus;
  scenario: MovementScenario | 'supporting'; ownerSlot: OwnerSlot;
  sourceMappingReportId: string | null; sourceRoomId: string; sourceDescription: string;
  destinationRoomId: string; destinationDescription: string; orgScopeId: string;
  quantity: number; distributedQuantity: number;
}
export interface PackingUnitSeed {
  id: string; description: string; shipmentId: string | null; status: PackingUnitStatus;
  sourceDescription: string; destinationDescription: string; sourceRoomId: string;
  destinationRoomId: string; orgScopeId: string; packingUnitType: PackingUnitType;
  serialNumber: number; idempotencyKey: string;
}
export interface ShipmentSeed {
  id: string; description: string; status: ShipmentStatus; sourceDescription: string;
  destinationDescription: string; sourceRoomId: string; destinationRoomId: string;
  orgScopeId: string; transportType: TransportType; transportDescription: string;
  vehicleIdentifier: string; transportAt: Date; idempotencyKey: string;
}

function uuid(namespace: number, ordinal: number): string {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
}

type UnitShape = { unit: string; anafim: number[][] };
// Nested arrays are Anafim; each number is that Anaf's Mador team count.
const unitShapes: UnitShape[] = [
  { unit: '01', anafim: [[3, 2], [2, 2], [3, 2]] },
  { unit: '02', anafim: [[3, 2], [2, 2], [3]] },
  { unit: '03', anafim: [[3, 2], [3, 2]] },
  { unit: '04', anafim: [[2, 2], [3, 2]] },
  { unit: '05', anafim: [[2, 2], [3]] },
  { unit: '06', anafim: [[3], [2]] },
  { unit: '07', anafim: [[2, 2]] },
  { unit: '08', anafim: [[2, 1]] },
];

export const orgScopes: OrgSeed[] = [];
for (const unitShape of unitShapes) {
  unitShape.anafim.forEach((madorTeams, anafIndex) => {
    madorTeams.forEach((teamCount, madorIndex) => {
      for (let teamIndex = 0; teamIndex < teamCount; teamIndex += 1) {
        const anaf = String(anafIndex + 1).padStart(2, '0');
        const mador = String(madorIndex + 1).padStart(2, '0');
        const team = String(teamIndex + 1).padStart(2, '0');
        const orgCode = `${unitShape.unit}${anaf}${mador}${team}`;
        orgScopes.push({ id: uuid(0x10000000, Number(orgCode)), unit: unitShape.unit, anaf, mador, team, orgCode, description: `${unitShape.unit} / ${anaf} / ${mador} / ${team}` });
      }
    });
  });
}

// The two active scopes have multiple rooms so a shipment can contain units
// from multiple source rooms while preserving the current scope invariant.
// Use scopes from different Units/Anafim/Madors so shared destinations exercise
// hierarchy filtering without violating the current child-scope invariant.
const activeScopeIndexes = [0, 31];
const rooms: RoomSeed[] = [];
// HACK-SEED-DATA-01 ended at report-000031; continue the deterministic series.
let reportNumber = 32;
for (const [scopeIndex, scope] of orgScopes.entries()) {
  const roomCount = activeScopeIndexes.includes(scopeIndex) ? 8 : 1;
  for (let roomNumber = 1; roomNumber <= roomCount; roomNumber += 1) {
    const suffix = String(roomNumber).padStart(2, '0');
    rooms.push({ id: `room-${scope.orgCode}-${suffix}`, description: `חדר-${scope.orgCode}-${suffix}`, orgScopeId: scope.id, mappingReportId: `report-${String(reportNumber++).padStart(6, '0')}` });
  }
}
rooms[rooms.length - 2].mappingReportId = null;
rooms[rooms.length - 1].mappingReportId = null;

const destinationRows = [
  ['יעד-001', 'בניין 12, קומה 1, חדר 101', '12', '1', '101'],
  ['יעד-002', 'בניין 12, קומה 1, חדר 102', '12', '1', '102'],
  ['יעד-003', 'בניין 14, קומה 2, חדר 201', '14', '2', '201'],
  ['יעד-004', 'בניין 14, קומה 2, חדר 204', '14', '2', '204'],
  ['יעד-005', 'בניין 18, קומה 1, חדר 101', '18', '1', '101'],
  ['יעד-006', 'בניין 18, קומה 1, חדר 102', '18', '1', '102'],
  ['יעד-007', 'בניין 21, קומה 3, חדר 301', '21', '3', '301'],
  ['יעד-008', 'בניין 21, קומה 3, חדר 305', '21', '3', '305'],
  ['יעד-009', 'בניין 25, קומה 1, חדר 110', '25', '1', '110'],
  ['יעד-010', 'בניין 25, קומה 1, חדר 115', '25', '1', '115'],
  ['יעד-011', 'בניין 30, קומה 2, חדר 220', '30', '2', '220'],
  ['יעד-012', 'בניין 30, קומה 2, חדר 225', '30', '2', '225'],
] as const;
export const destinations: DestinationSeed[] = destinationRows.map(([id, description, building, floor, room], index) => ({ id, description, building, floor, room, orgScopeId: orgScopes[activeScopeIndexes[index % activeScopeIndexes.length]].id }));

const descriptions = [
  'מחשב נייח', 'מחשב נייד', 'מסך 24', 'מסך 27', 'מקלדת', 'עכבר', 'תחנת עגינה', 'מצלמת רשת',
  'מדפסת', 'סורק', 'מתג תקשורת', 'נתב', 'נקודת גישה', 'מודול SFP', 'כבלי רשת', 'פאנל תקשורת',
  'UPS', 'שרת', 'NAS', 'PDU', 'מסילת Rack', 'ציוד Rack', 'שולחן', 'כיסא', 'ארון מסמכים',
  'קלסרים', 'לוח תכנון', 'מסך חמ״ל', 'טלפון IP', 'מכשיר קשר', 'ערכת חירום', 'ציוד שליטה',
] as const;
const quantities = [1, 2, 3, 4, 5, 8, 10, 15, 20] as const;
const statuses: ItemStatus[] = ['not_sent', 'assigned_to_packing_unit', 'in_transit', 'arrived_pending_verification', 'verified'];
const scopeRooms = (scopeIndex: number): RoomSeed[] => rooms.filter((room) => room.orgScopeId === orgScopes[scopeIndex].id);
const scopeZeroRooms = scopeRooms(activeScopeIndexes[0]);
const scopeOneRooms = scopeRooms(activeScopeIndexes[1]);
const scenarioRooms: Record<MovementScenario, RoomSeed[]> = {
  A: [scopeZeroRooms[0]],
  B: [scopeOneRooms[0]],
  C: [...scopeZeroRooms.slice(1, 4), ...scopeOneRooms.slice(1, 4)],
  D: [...scopeZeroRooms.slice(4), ...scopeOneRooms.slice(4)],
};
const scenarioDestinations: Record<MovementScenario, DestinationSeed[]> = {
  A: [destinations[0]],
  B: [destinations[1], destinations[2], destinations[3]],
  C: [destinations[4]],
  D: [destinations[5], destinations[6], destinations[7], destinations[8]],
};

const mutableItems: ItemSeed[] = [];
function addItem(scenario: MovementScenario | 'supporting', status: ItemStatus, room: RoomSeed, destination: DestinationSeed, ordinal: number, ownerSlot: OwnerSlot): void {
  const quantity = quantities[(ordinal * 7 + status.length) % quantities.length];
  const distributedQuantity = status === 'not_sent' ? 0 : status === 'assigned_to_packing_unit' ? Math.max(1, Math.floor(quantity / 2)) : quantity;
  mutableItems.push({ id: uuid(0x30000000, ordinal), description: descriptions[(ordinal - 1) % descriptions.length], packingUnitId: null, status, scenario, ownerSlot, sourceMappingReportId: room.mappingReportId, sourceRoomId: room.id, sourceDescription: room.description, destinationRoomId: destination.id, destinationDescription: destination.description, orgScopeId: room.orgScopeId, quantity, distributedQuantity });
}

let itemOrdinal = 1;
for (const scenario of ['A', 'B', 'C', 'D'] as const) {
  for (const status of statuses) {
    for (let example = 0; example < 8; example += 1) {
      const statusIndex = statuses.indexOf(status);
      const sourceRoom = scenarioRooms[scenario][(example + statusIndex) % scenarioRooms[scenario].length];
      const destination = scenarioDestinations[scenario][(example + statusIndex) % scenarioDestinations[scenario].length];
      addItem(scenario, status, sourceRoom, destination, itemOrdinal, itemOrdinal % 11 === 0 ? 'secondary' : 'none');
      itemOrdinal += 1;
    }
  }
}
for (const room of rooms.slice(-2)) {
  addItem('supporting', 'not_sent', room, destinations[9 + (itemOrdinal % 3)], itemOrdinal, 'none');
  itemOrdinal += 1;
}
export const items: ItemSeed[] = mutableItems;

const shipmentPlans: Array<[ShipmentStatus, number, number, TransportType, string, string, string]> = [
  ['not_sent', 0, 1, 'truck', 'הובלה מתוכננת א', 'GS-PLAN-01', '2026-09-24T06:00:00.000Z'],
  ['not_sent', 31, 2, 'other', 'הובלה מתוכננת ב', 'GS-PLAN-02', '2026-09-24T07:00:00.000Z'],
  ['sent', 0, 3, 'truck', 'הובלה בתנועה א', 'GS-TRANSIT-01', '2026-09-23T05:30:00.000Z'],
  ['sent', 31, 4, 'truck', 'הובלה בתנועה ב', 'GS-TRANSIT-02', '2026-09-23T06:00:00.000Z'],
  ['arrived', 0, 5, 'other', 'הובלה שהגיעה א', 'GS-ARRIVED-01', '2026-09-22T11:00:00.000Z'],
  ['arrived', 31, 6, 'truck', 'הובלה שהגיעה ב', 'GS-ARRIVED-02', '2026-09-22T12:00:00.000Z'],
  ['verified', 0, 7, 'truck', 'הובלה מאומתת א', 'GS-VERIFIED-01', '2026-09-21T07:15:00.000Z'],
  ['verified', 31, 8, 'other', 'הובלה מאומתת ב', 'GS-VERIFIED-02', '2026-09-21T08:15:00.000Z'],
];
export const shipments: ShipmentSeed[] = shipmentPlans.map(([status, scopeIndex, destinationIndex, transportType, description, vehicleIdentifier, transportAt], index) => {
  const sourceRoom = scopeRooms(scopeIndex)[0];
  const destination = destinations[destinationIndex];
  return { id: uuid(0x50000000, index + 1), description, status, sourceDescription: sourceRoom.description, destinationDescription: destination.description, sourceRoomId: sourceRoom.id, destinationRoomId: destination.id, orgScopeId: orgScopes[scopeIndex].id, transportType, transportDescription: transportType === 'truck' ? 'משאית תפעולית' : 'רכב תפעולי', vehicleIdentifier, transportAt: new Date(transportAt), idempotencyKey: `hack-seed-02-shipment-${String(index + 1).padStart(3, '0')}` };
});
const shipmentIdsByStatus: Record<ShipmentStatus, string[]> = { not_sent: shipments.filter((x) => x.status === 'not_sent').map((x) => x.id), sent: shipments.filter((x) => x.status === 'sent').map((x) => x.id), arrived: shipments.filter((x) => x.status === 'arrived').map((x) => x.id), verified: shipments.filter((x) => x.status === 'verified').map((x) => x.id) };

const packingStatusForItem: Record<Exclude<ItemStatus, 'not_sent'>, PackingUnitStatus> = { assigned_to_packing_unit: 'assigned_to_shipment', in_transit: 'in_transit', arrived_pending_verification: 'arrived_pending_verification', verified: 'verified' };
const packingShipmentStatus: Record<Exclude<PackingUnitStatus, 'not_sent'>, ShipmentStatus> = { assigned_to_shipment: 'not_sent', in_transit: 'sent', arrived_pending_verification: 'arrived', verified: 'verified' };
const nonEmptyPackingStatuses: Exclude<PackingUnitStatus, 'not_sent'>[] = ['assigned_to_shipment', 'in_transit', 'arrived_pending_verification', 'verified'];
const packingTypes: PackingUnitType[] = ['personal_carton', 'personal_carton', 'bulk', 'pallet', 'dolav', 'professional_carton', 'professional_carton', 'dolav', 'pallet', 'bulk', 'professional_carton', 'dolav', 'pallet', 'bulk', 'professional_carton', 'dolav', 'pallet', 'bulk', 'professional_carton', 'dolav', 'pallet', 'bulk', 'professional_carton', 'dolav', 'pallet', 'bulk', 'professional_carton', 'dolav', 'pallet', 'bulk', 'professional_carton', 'dolav'];

export const packingUnits: PackingUnitSeed[] = [];
let packingOrdinal = 1;
function addEmptyPackingUnit(status: PackingUnitStatus, type: PackingUnitType): void {
  const scopeIndex = activeScopeIndexes[(packingOrdinal + 1) % activeScopeIndexes.length];
  const sourceRoom = scopeRooms(scopeIndex)[0];
  const destination = destinations[packingOrdinal % destinations.length];
  const shipmentId = status === 'not_sent' ? null : shipmentIdsByStatus[packingShipmentStatus[status]][(packingOrdinal + 1) % 2];
  packingUnits.push({ id: uuid(0x40000000, packingOrdinal), description: `יחידת אריזה ${String(packingOrdinal).padStart(2, '0')}`, shipmentId, status, sourceDescription: sourceRoom.description, destinationDescription: destination.description, sourceRoomId: sourceRoom.id, destinationRoomId: destination.id, orgScopeId: orgScopes[scopeIndex].id, packingUnitType: type, serialNumber: 910000 + packingOrdinal, idempotencyKey: `hack-seed-02-packing-unit-${String(packingOrdinal).padStart(3, '0')}` });
  packingOrdinal += 1;
}
for (let index = 0; index < 8; index += 1) addEmptyPackingUnit('not_sent', packingTypes[index]);

for (const itemStatus of nonEmptyPackingStatuses) {
  const expectedItemStatus = Object.entries(packingStatusForItem).find(([, value]) => value === itemStatus)?.[0] as ItemStatus;
  const children = items.filter((item) => item.status === expectedItemStatus);
  for (const scopeIndex of activeScopeIndexes) {
    const scopeChildren = children.filter((item) => item.orgScopeId === orgScopes[scopeIndex].id);
    const chunkSize = Math.ceil(scopeChildren.length / 3);
    for (let offset = 0; offset < scopeChildren.length; offset += chunkSize) {
      const group = scopeChildren.slice(offset, offset + chunkSize);
      const first = group[0];
      const shipmentIndex = scopeIndex === activeScopeIndexes[0] ? 0 : 1;
      const packingUnit: PackingUnitSeed = { id: uuid(0x40000000, packingOrdinal), description: `יחידת אריזה ${String(packingOrdinal).padStart(2, '0')}`, shipmentId: shipmentIdsByStatus[packingShipmentStatus[itemStatus]][shipmentIndex], status: itemStatus, sourceDescription: first.sourceDescription, destinationDescription: first.destinationDescription, sourceRoomId: first.sourceRoomId, destinationRoomId: first.destinationRoomId, orgScopeId: orgScopes[scopeIndex].id, packingUnitType: packingTypes[packingOrdinal - 1], serialNumber: 910000 + packingOrdinal, idempotencyKey: `hack-seed-02-packing-unit-${String(packingOrdinal).padStart(3, '0')}` };
      packingUnits.push(packingUnit);
      for (const child of group) child.packingUnitId = packingUnit.id;
      packingOrdinal += 1;
    }
  }
}

export const hackathonDataset = { orgScopes, rooms, destinations, items, packingUnits, shipments } as const;
