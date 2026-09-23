import type {
  ItemStatus,
  PackingUnitStatus,
  PackingUnitType,
  ShipmentStatus,
  TransportType,
} from '@prisma/client';

export const SEED_NAME = 'HACK-SEED-DATA-01';
export const SEED_TIMESTAMP = new Date('2026-09-23T08:00:00.000Z');

export interface OrgSeed {
  id: string;
  unit: string;
  anaf: string;
  mador: string;
  team: string;
  orgCode: string;
  description: string;
}

export interface RoomSeed {
  id: string;
  description: string;
  orgScopeId: string;
  mappingReportId: string | null;
}

export interface DestinationSeed {
  id: string;
  description: string;
  building: string;
  floor: string;
  room: string;
  orgScopeId: string;
}

export interface ItemSeed {
  id: string;
  description: string;
  packingUnitId: string | null;
  status: ItemStatus;
  sourceMappingReportId: string | null;
  sourceRoomId: string;
  sourceDescription: string;
  destinationRoomId: string;
  destinationDescription: string;
  orgScopeId: string;
  quantity: number;
  distributedQuantity: number;
}

export interface PackingUnitSeed {
  id: string;
  description: string;
  shipmentId: string | null;
  status: PackingUnitStatus;
  sourceDescription: string;
  destinationDescription: string;
  sourceRoomId: string;
  destinationRoomId: string;
  orgScopeId: string;
  packingUnitType: PackingUnitType;
  serialNumber: number;
  idempotencyKey: string;
}

export interface ShipmentSeed {
  id: string;
  description: string;
  status: ShipmentStatus;
  sourceDescription: string;
  destinationDescription: string;
  sourceRoomId: string;
  destinationRoomId: string;
  orgScopeId: string;
  transportType: TransportType;
  transportDescription: string;
  vehicleIdentifier: string;
  transportAt: Date;
  idempotencyKey: string;
}

type Team = [code: string, name: string];
type Mador = [code: string, name: string, teams: Team[]];
type Anaf = [code: string, name: string, madors: Mador[]];
type Unit = [code: string, name: string, anafim: Anaf[]];

const hierarchy: Unit[] = [
  [
    '01',
    'יחידת מבצעים',
    [
      [
        '01',
        'ענף תכנון ובקרה',
        [
          [
            '01',
            'מדור תכנון',
            [
              ['01', 'צוות תכנון א'],
              ['02', 'צוות תכנון ב'],
              ['03', 'צוות תמונת מצב'],
            ],
          ],
          [
            '02',
            'מדור שליטה',
            [
              ['01', 'צוות חמ״ל'],
              ['02', 'צוות בקרה'],
            ],
          ],
        ],
      ],
      [
        '02',
        'ענף לוגיסטיקה',
        [
          [
            '01',
            'מדור ציוד',
            [
              ['01', 'צוות מחסנים'],
              ['02', 'צוות רכש'],
              ['03', 'צוות ספירות'],
            ],
          ],
          [
            '02',
            'מדור הובלה',
            [
              ['01', 'צוות תובלה'],
              ['02', 'צוות תיאום'],
            ],
          ],
        ],
      ],
      [
        '03',
        'ענף הפעלה',
        [
          [
            '01',
            'מדור מוכנות',
            [
              ['01', 'צוות כשירות'],
              ['02', 'צוות תרגילים'],
            ],
          ],
        ],
      ],
    ],
  ],
  [
    '02',
    'יחידת תקשוב',
    [
      [
        '01',
        'ענף תשתיות',
        [
          [
            '01',
            'מדור רשתות',
            [
              ['01', 'צוות תקשורת'],
              ['02', 'צוות נתבים'],
              ['03', 'צוות אלחוט'],
            ],
          ],
          [
            '02',
            'מדור שרתים',
            [
              ['01', 'צוות סיסטם'],
              ['02', 'צוות אחסון'],
            ],
          ],
        ],
      ],
      [
        '02',
        'ענף מערכות',
        [
          [
            '01',
            'מדור יישומים',
            [
              ['01', 'צוות פיתוח'],
              ['02', 'צוות יישום'],
            ],
          ],
          [
            '02',
            'מדור תמיכה',
            [
              ['01', 'צוות מוקד'],
              ['02', 'צוות שטח'],
            ],
          ],
        ],
      ],
    ],
  ],
  [
    '03',
    'יחידת מודיעין',
    [
      [
        '01',
        'ענף מחקר',
        [
          [
            '01',
            'מדור ניתוח',
            [
              ['01', 'צוות זירה א'],
              ['02', 'צוות זירה ב'],
              ['03', 'צוות נתונים'],
            ],
          ],
          [
            '02',
            'מדור הערכה',
            [
              ['01', 'צוות הערכה'],
              ['02', 'צוות תיעוד'],
            ],
          ],
        ],
      ],
      [
        '02',
        'ענף סיוע',
        [
          [
            '01',
            'מדור תמיכה מודיעינית',
            [
              ['01', 'צוות הפקה'],
              ['02', 'צוות הנגשה'],
            ],
          ],
        ],
      ],
    ],
  ],
  [
    '04',
    'יחידת מנהלה',
    [
      [
        '01',
        'ענף משאבי אנוש ומנהלה',
        [
          [
            '01',
            'מדור פרט',
            [
              ['01', 'צוות סגל'],
              ['02', 'צוות רווחה'],
            ],
          ],
          [
            '02',
            'מדור מנהלה',
            [
              ['01', 'צוות משרד'],
              ['02', 'צוות אחזקה'],
            ],
          ],
        ],
      ],
    ],
  ],
];

function uuid(namespace: number, ordinal: number): string {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
}

export const orgScopes: OrgSeed[] = hierarchy.flatMap(
  ([unitCode, unit, anafim]) =>
    anafim.flatMap(([anafCode, anaf, madors]) =>
      madors.flatMap(([madorCode, mador, teams]) =>
        teams.map(([teamCode, team]) => {
          const orgCode = `${unitCode}${anafCode}${madorCode}${teamCode}`;
          return {
            id: uuid(0x10000000, Number(orgCode)),
            unit,
            anaf,
            mador,
            team,
            orgCode,
            description: `${unit} / ${anaf} / ${mador} / ${team}`,
          };
        }),
      ),
    ),
);

const roomNames = [
  'לשכת מפקד',
  'מחסן ציוד',
  'חדר מחשוב',
  'חדר תקשורת',
  'חדר תכנון',
  'חדר צוות',
  'חדר שרתים',
  'מחסן מסמכים',
  'חמ״ל יחידה',
  'מטבחון קומה 1',
];

let reportNumber = 1;
export const rooms: RoomSeed[] = orgScopes.map((scope, index) => {
  const name = `${roomNames[index % roomNames.length]} ${String(Math.floor(index / 10) + 1).padStart(2, '0')}`;
  return {
    id: `${name} — ${scope.orgCode}`,
    description: `${name}, ${scope.unit}, ${scope.mador}`,
    orgScopeId: scope.id,
    mappingReportId:
      index === 12 ? null : `report-${String(reportNumber++).padStart(6, '0')}`,
  };
});

const destinationRows = [
  ['לשכה דרומית', 'בניין מפקדה דרום, חדר 101', 'מפקדה דרום', '1', '101'],
  ['חדר 201', 'בניין 14, קומה 2, חדר 201', '14', '2', '201'],
  ['חדר 204', 'בניין 14, קומה 2, חדר 204', '14', '2', '204'],
  [
    'חדר תקשורת 2',
    'בניין תקשוב דרום, חדר תקשורת 2',
    'תקשוב דרום',
    '1',
    'תקשורת 2',
  ],
  ['חדר שרתים דרום', 'דאטה סנטר דרום', 'דאטה סנטר דרום', 'קרקע', 'שרתים'],
  ['מחסן קליטה 3', 'בניין לוגיסטיקה דרום', 'לוגיסטיקה דרום', 'קרקע', 'מחסן 3'],
  [
    'חדר ישיבות דרום',
    'בניין מפקדה דרום, חדר ישיבות',
    'מפקדה דרום',
    '2',
    'ישיבות',
  ],
  ['חדר צוות 1', 'בניין 18, קומה 1, חדר צוות 1', '18', '1', 'צוות 1'],
  ['חמ״ל רפואה', 'בניין רפואה דרום, חמ״ל', 'רפואה דרום', 'קרקע', 'חמ״ל'],
  [
    'מטבחון קומה 1',
    'בניין מנהלה דרום, מטבחון קומה 1',
    'מנהלה דרום',
    '1',
    'מטבחון',
  ],
  [
    'מרכז בקרה דרום',
    'בניין מבצעים דרום, מרכז בקרה',
    'מבצעים דרום',
    '1',
    'מרכז בקרה',
  ],
  ['ארכיון דרומי', 'בניין מנהלה דרום, ארכיון', 'מנהלה דרום', 'מרתף', 'ארכיון'],
] as const;

export const destinations: DestinationSeed[] = destinationRows.map(
  ([id, description, building, floor, room], index) => ({
    id,
    description,
    building,
    floor,
    room,
    orgScopeId: orgScopes[index].id,
  }),
);

const descriptions = [
  'מחשב נייח',
  'מחשב נייד',
  'מסך 24״',
  'מסך 27״',
  'תחנת עגינה',
  'מקלדת',
  'עכבר',
  'מצלמת רשת',
  'מתג תקשורת',
  'נתב',
  'נקודת גישה',
  'פאנל תקשורת',
  'כבלי רשת',
  'מודול SFP',
  'UPS',
  'כיסא משרדי',
  'שולחן עבודה',
  'ארון מסמכים',
  'קלסרי פקודות',
  'מדפסת',
  'סורק',
  'מסך חמ״ל',
  'טלפון IP',
  'מכשיר קשר',
  'לוח תכנון',
  'ערכת חירום',
  'שרת',
  'NAS',
  'PDU',
  'מסילת Rack',
  'ציוד Rack',
];
const quantities = [1, 2, 3, 4, 5, 10, 20];

function destinationFor(scopeIndex: number, ordinal: number): DestinationSeed {
  if (scopeIndex === 0) return destinations[0];
  if (scopeIndex === 1)
    return ordinal === 0 ? destinations[2] : destinations[1];
  if (scopeIndex === 2 || scopeIndex === 3) return destinations[3];
  return destinations[(scopeIndex * 2 + ordinal * 3) % destinations.length];
}

const mutableItems: ItemSeed[] = [];
function addItem(
  scopeIndex: number,
  ordinal: number,
  status: ItemStatus,
): void {
  const room = rooms[scopeIndex];
  const destination = destinationFor(scopeIndex, ordinal);
  const number = mutableItems.length + 1;
  const quantity = quantities[(number * 3 + scopeIndex) % quantities.length];
  mutableItems.push({
    id: uuid(0x30000000, number),
    description: descriptions[(number - 1) % descriptions.length],
    packingUnitId: null,
    status,
    sourceMappingReportId: room.mappingReportId,
    sourceRoomId: room.id,
    sourceDescription: room.description,
    destinationRoomId: destination.id,
    destinationDescription: destination.description,
    orgScopeId: room.orgScopeId,
    quantity,
    distributedQuantity: status === 'verified' ? quantity : 0,
  });
}

orgScopes.forEach((_scope, index) => addItem(index, 0, 'not_sent'));
for (let index = 12; index < 28; index += 1) addItem(index, 1, 'not_sent');
for (let ordinal = 1; ordinal <= 6; ordinal += 1)
  addItem(0, ordinal, 'assigned_to_packing_unit');
for (let ordinal = 1; ordinal <= 4; ordinal += 1)
  addItem(1, ordinal, 'in_transit');
for (let ordinal = 1; ordinal <= 3; ordinal += 1)
  addItem(2, ordinal, 'arrived_pending_verification');
for (let ordinal = 1; ordinal <= 3; ordinal += 1)
  addItem(3, ordinal, 'verified');

export const shipments: ShipmentSeed[] = [
  [
    'not_sent',
    0,
    0,
    'הובלה מתוכננת — ציוד תכנון ובקרה',
    'truck',
    'משאית ארגז סגור',
    'GS-PLAN-01',
    '2026-09-24T06:00:00.000Z',
  ],
  [
    'sent',
    1,
    1,
    'הובלה בתנועה — ציוד שליטה',
    'truck',
    'משאית לוגיסטית',
    'GS-TRANSIT-02',
    '2026-09-23T05:30:00.000Z',
  ],
  [
    'arrived',
    2,
    3,
    'הובלה שהגיעה — ציוד מחסנים',
    'other',
    'רכב תפעולי מאובטח',
    'GS-ARRIVED-03',
    '2026-09-22T11:00:00.000Z',
  ],
  [
    'verified',
    3,
    3,
    'הובלה מאומתת — ציוד חמ״ל',
    'truck',
    'משאית הפצה',
    'GS-VERIFIED-04',
    '2026-09-21T07:15:00.000Z',
  ],
].map(
  (
    [
      status,
      scopeIndex,
      destinationIndex,
      description,
      transportType,
      transportDescription,
      vehicleIdentifier,
      transportAt,
    ],
    index,
  ) => {
    const scope = Number(scopeIndex);
    const destination = destinations[Number(destinationIndex)];
    return {
      id: uuid(0x50000000, index + 1),
      description: String(description),
      status: status as ShipmentStatus,
      sourceDescription: rooms[scope].description,
      destinationDescription: destination.description,
      sourceRoomId: rooms[scope].id,
      destinationRoomId: destination.id,
      orgScopeId: orgScopes[scope].id,
      transportType: transportType as TransportType,
      transportDescription: String(transportDescription),
      vehicleIdentifier: String(vehicleIdentifier),
      transportAt: new Date(String(transportAt)),
      idempotencyKey: `hack-seed-shipment-${String(index + 1).padStart(3, '0')}`,
    };
  },
);

const packingStatus: Record<
  Exclude<ItemStatus, 'not_sent'>,
  PackingUnitStatus
> = {
  assigned_to_packing_unit: 'assigned_to_shipment',
  in_transit: 'in_transit',
  arrived_pending_verification: 'arrived_pending_verification',
  verified: 'verified',
};
const shipmentForStatus: Record<Exclude<ItemStatus, 'not_sent'>, string> = {
  assigned_to_packing_unit: shipments[0].id,
  in_transit: shipments[1].id,
  arrived_pending_verification: shipments[2].id,
  verified: shipments[3].id,
};
const contentTypes: PackingUnitType[] = [
  'professional_carton',
  'pallet',
  'dolav',
  'professional_carton',
  'bulk',
  'dolav',
  'pallet',
  'professional_carton',
  'bulk',
];

export const packingUnits: PackingUnitSeed[] = [];
for (const status of [
  'assigned_to_packing_unit',
  'in_transit',
  'arrived_pending_verification',
  'verified',
] as const) {
  const children = mutableItems.filter((item) => item.status === status);
  for (let offset = 0; offset < children.length; offset += 2) {
    const group = children.slice(offset, offset + 2);
    const first = group[0];
    const ordinal = packingUnits.length + 1;
    const id = uuid(0x40000000, ordinal);
    group.forEach((item) => {
      item.packingUnitId = id;
    });
    packingUnits.push({
      id,
      description: `יחידת אריזה ${String(ordinal).padStart(2, '0')} — ${group.map((item) => item.description).join(', ')}`,
      shipmentId: shipmentForStatus[status],
      status: packingStatus[status],
      sourceDescription: first.sourceDescription,
      destinationDescription: first.destinationDescription,
      sourceRoomId: first.sourceRoomId,
      destinationRoomId: first.destinationRoomId,
      orgScopeId: first.orgScopeId,
      packingUnitType: contentTypes[ordinal - 1],
      serialNumber: 900000 + ordinal,
      idempotencyKey: `hack-seed-packing-unit-${String(ordinal).padStart(3, '0')}`,
    });
  }
}

function emptyUnit(
  ordinal: number,
  scopeIndex: number,
  type: PackingUnitType,
  status: PackingUnitStatus,
  shipmentId: string | null,
  description: string,
): PackingUnitSeed {
  const destination = destinationFor(scopeIndex, 0);
  return {
    id: uuid(0x40000000, ordinal),
    description,
    shipmentId,
    status,
    sourceDescription: rooms[scopeIndex].description,
    destinationDescription: destination.description,
    sourceRoomId: rooms[scopeIndex].id,
    destinationRoomId: destination.id,
    orgScopeId: orgScopes[scopeIndex].id,
    packingUnitType: type,
    serialNumber: 900000 + ordinal,
    idempotencyKey: `hack-seed-packing-unit-${String(ordinal).padStart(3, '0')}`,
  };
}

packingUnits.push(
  emptyUnit(
    10,
    5,
    'professional_carton',
    'not_sent',
    null,
    'קרטון מקצועי מוכן לאריזה',
  ),
  emptyUnit(
    11,
    4,
    'personal_carton',
    'not_sent',
    null,
    'קרטון אישי — ציוד אישי של איש צוות',
  ),
  emptyUnit(
    12,
    3,
    'personal_carton',
    'verified',
    shipments[3].id,
    'קרטון אישי — התקבל ואומת ללא פריטי מיפוי',
  ),
);

export const items: readonly ItemSeed[] = mutableItems;
export const hackathonDataset = {
  orgScopes,
  rooms,
  destinations,
  items,
  packingUnits,
  shipments,
} as const;
