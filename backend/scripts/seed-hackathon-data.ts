import type {
  ItemStatus,
  PackingUnitStatus,
  Prisma,
  PrismaClient,
  ShipmentStatus,
} from '@prisma/client';
import {
  SEED_NAME,
  SEED_TIMESTAMP,
  hackathonDataset,
  type MovementScenario,
  type OrgSeed,
} from './seed-data/hackathon-data.ts';

type Mode = 'dry-run' | 'apply';
type Db = PrismaClient | Prisma.TransactionClient;

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Seed invariant failed: ${message}`);
}

function modeFrom(args: string[]): Mode {
  const unknown = args.filter(
    (value) => !['--dry-run', '--apply'].includes(value),
  );
  invariant(unknown.length === 0, `unknown argument(s): ${unknown.join(', ')}`);
  invariant(
    !(args.includes('--dry-run') && args.includes('--apply')),
    'choose one mode',
  );
  return args.includes('--apply') ? 'apply' : 'dry-run';
}

function counts(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function hierarchyCounts() {
  const { orgScopes } = hackathonDataset;
  return {
    units: new Set(orgScopes.map((scope) => scope.unit)).size,
    anafim: new Set(orgScopes.map((scope) => `${scope.unit}\0${scope.anaf}`))
      .size,
    madors: new Set(
      orgScopes.map((scope) => `${scope.unit}\0${scope.anaf}\0${scope.mador}`),
    ).size,
    teams: orgScopes.length,
  };
}

function scenarioCoverage(): Record<MovementScenario, Record<string, number>> {
  const result = {} as Record<MovementScenario, Record<string, number>>;
  for (const scenario of ['A', 'B', 'C', 'D'] as const) {
    result[scenario] = counts(
      hackathonDataset.items
        .filter((item) => item.scenario === scenario)
        .map((item) => item.status),
    );
  }
  return result;
}

function validateDefinition(): void {
  const hierarchy = hierarchyCounts();
  invariant(
    hierarchy.units >= 8 && hierarchy.anafim >= 16 && hierarchy.madors >= 28 && hierarchy.teams >= 64,
    'hierarchy must meet 8 Units / 16 Anafim / 28 Madors / 64 Teams',
  );
  invariant(
    hackathonDataset.orgScopes.every(
      (scope) =>
        /^\d{2}$/.test(scope.unit) &&
        /^\d{2}$/.test(scope.anaf) &&
        /^\d{2}$/.test(scope.mador) &&
        /^\d{2}$/.test(scope.team) &&
        /^\d{8}$/.test(scope.orgCode) &&
        scope.description === `${scope.unit} / ${scope.anaf} / ${scope.mador} / ${scope.team}`,
    ),
    'organization labels must be numeric-only and canonical',
  );
  invariant(
    new Set(hackathonDataset.orgScopes.map((scope) => scope.orgCode)).size === hierarchy.teams,
    'Team Org codes must be unique',
  );

  const mappedRooms = hackathonDataset.rooms.filter((room) => room.mappingReportId);
  const reports = mappedRooms.map((room) => room.mappingReportId as string);
  invariant(hackathonDataset.rooms.length >= 64, 'expected at least 64 source Rooms');
  invariant(
    reports.length === hackathonDataset.rooms.length - 2 &&
      reports.every((report, index) => report === `report-${String(index + 32).padStart(6, '0')}`),
    'MappingReport sequence',
  );
  invariant(
    new Set(hackathonDataset.rooms.map((room) => room.id)).size === hackathonDataset.rooms.length &&
      hackathonDataset.rooms.every((room) => room.description === room.id.replace('room-', 'חדר-')),
    'source Room identity and descriptions',
  );

  invariant(hackathonDataset.destinations.length === 12, 'expected 12 canonical destinations');
  invariant(
    new Set(hackathonDataset.destinations.map((destination) => destination.id)).size === 12 &&
      hackathonDataset.destinations.every((destination) => !destination.description.trim().startsWith('{')),
    'destination IDs must be unique and descriptions must not be JSON',
  );

  invariant(hackathonDataset.items.length >= 114, 'expected at least 50 Items beyond the original dataset');
  const itemCounts = counts(hackathonDataset.items.map((item) => item.status));
  invariant(
    itemCounts.not_sent === 34 && itemCounts.assigned_to_packing_unit === 32 &&
      itemCounts.in_transit === 32 && itemCounts.arrived_pending_verification === 32 &&
      itemCounts.verified === 32,
    'Item status distribution',
  );
  const unmapped = hackathonDataset.items.filter((item) => item.sourceMappingReportId === null);
  invariant(unmapped.length >= 2 && unmapped.length <= 4, 'only a few unmapped Items');
  invariant(unmapped.every((item) => item.scenario === 'supporting'), 'unmapped Items are dedicated examples');
  invariant(
    hackathonDataset.items.every((item) => {
      const room = hackathonDataset.rooms.find((candidate) => candidate.id === item.sourceRoomId);
      return room?.orgScopeId === item.orgScopeId && room.description === item.sourceDescription &&
        (room.mappingReportId === item.sourceMappingReportId || item.sourceMappingReportId === null);
    }),
    'Item source Room/org/report consistency',
  );
  invariant(
    hackathonDataset.items.every((item) => item.quantity > 0 && item.distributedQuantity >= 0 && item.distributedQuantity <= item.quantity),
    'Item quantity constraints',
  );
  invariant(
    [1, 2, 3, 4, 5, 8, 10, 15, 20].every((quantity) => hackathonDataset.items.some((item) => item.quantity === quantity)),
    'Item quantity variation',
  );
  invariant(
    hackathonDataset.items.filter((item) => item.status === 'not_sent').every((item) => item.packingUnitId === null && item.distributedQuantity === 0),
    'not_sent Items must be unpacked and undistributed',
  );
  invariant(hackathonDataset.items.some((item) => item.ownerSlot === 'secondary'), 'ownership visibility example');

  const matrix = scenarioCoverage();
  for (const scenario of ['A', 'B', 'C', 'D'] as const) {
    invariant(Object.values(matrix[scenario]).every((count) => count === 8), `${scenario} requires 8 examples per state`);
    const scenarioItems = hackathonDataset.items.filter((item) => item.scenario === scenario);
    const sources = new Set(scenarioItems.map((item) => item.sourceRoomId));
    const destinations = new Set(scenarioItems.map((item) => item.destinationRoomId));
    if (scenario === 'A') invariant(sources.size === 1 && destinations.size === 1, 'A is one source to one destination');
    if (scenario === 'B') invariant(sources.size === 1 && destinations.size > 1, 'B is one source to many destinations');
    if (scenario === 'C') invariant(sources.size > 1 && destinations.size === 1, 'C is many sources to one destination');
    if (scenario === 'D') invariant(sources.size > 1 && destinations.size > 1, 'D is many sources to many destinations');
  }

  invariant(hackathonDataset.packingUnits.length >= 28 && hackathonDataset.packingUnits.length <= 37, 'PackingUnit expansion size');
  const packingCounts = counts(hackathonDataset.packingUnits.map((unit) => unit.status));
  invariant(['not_sent', 'assigned_to_shipment', 'in_transit', 'arrived_pending_verification', 'verified'].every((status) => (packingCounts[status] ?? 0) >= 3), 'PackingUnit status coverage');
  invariant(new Set(hackathonDataset.packingUnits.map((unit) => unit.packingUnitType)).size === 5, 'all PackingUnit types');
  const personal = hackathonDataset.packingUnits.filter((unit) => unit.packingUnitType === 'personal_carton');
  invariant(personal.length >= 2 && personal.every((unit) => !hackathonDataset.items.some((item) => item.packingUnitId === unit.id)), 'Personal Cartons must be empty');
  const parentStatus: Record<Exclude<ItemStatus, 'not_sent'>, PackingUnitStatus> = {
    assigned_to_packing_unit: 'assigned_to_shipment', in_transit: 'in_transit', arrived_pending_verification: 'arrived_pending_verification', verified: 'verified',
  };
  for (const item of hackathonDataset.items) {
    if (item.status === 'not_sent') continue;
    const parent = hackathonDataset.packingUnits.find((unit) => unit.id === item.packingUnitId);
    invariant(parent, `Item ${item.id} parent exists`);
    invariant(parent.status === parentStatus[item.status] && parent.packingUnitType !== 'personal_carton' && parent.orgScopeId === item.orgScopeId, `Item ${item.id} parent relation`);
  }

  invariant(hackathonDataset.shipments.length >= 8 && hackathonDataset.shipments.length <= 12, 'Shipment expansion size');
  const shipmentCounts = counts(hackathonDataset.shipments.map((shipment) => shipment.status));
  invariant(['not_sent', 'sent', 'arrived', 'verified'].every((status) => (shipmentCounts[status] ?? 0) >= 2), 'Shipment status coverage');
  const shipmentStatus: Record<PackingUnitStatus, ShipmentStatus | null> = { not_sent: null, assigned_to_shipment: 'not_sent', in_transit: 'sent', arrived_pending_verification: 'arrived', verified: 'verified' };
  for (const unit of hackathonDataset.packingUnits) {
    const expected = shipmentStatus[unit.status];
    if (expected === null) invariant(unit.shipmentId === null, `${unit.id} must be standalone`);
    else {
      const shipment = hackathonDataset.shipments.find((row) => row.id === unit.shipmentId);
      invariant(shipment, `${unit.id} Shipment exists`);
      invariant(shipment.status === expected && shipment.orgScopeId === unit.orgScopeId, `${unit.id} Shipment relation`);
    }
  }
  invariant(hackathonDataset.shipments.every((shipment) => hackathonDataset.packingUnits.filter((unit) => unit.shipmentId === shipment.id).length > 0), 'every Shipment has PackingUnits');
}

function summary(mode: Mode): void {
  const hierarchy = hierarchyCounts();
  const matrix = scenarioCoverage();
  const format = (value: Record<string, number>) =>
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => `${key}=${count}`)
      .join(', ');
  console.log(`\n${SEED_NAME}`);
  console.log(
    `Mode: ${mode === 'apply' ? 'APPLY' : 'DRY-RUN (no database connection or mutation)'}`,
  );
  console.log('ORGANIZATION');
  console.log(`  Units: ${hierarchy.units}`);
  console.log(`  Anafim: ${hierarchy.anafim}`);
  console.log(`  Madors: ${hierarchy.madors}`);
  console.log(`  Teams: ${hierarchy.teams}`);
  console.log('  ORG LABELS NUMERIC ONLY: PASS');
  console.log(`Source Rooms: ${hackathonDataset.rooms.length}`);
  console.log(
    `Destinations (canonical snapshots; no current table): ${hackathonDataset.destinations.length}`,
  );
  console.log(
    `MappingReports: ${hackathonDataset.rooms.filter((room) => room.mappingReportId).length}`,
  );
  console.log('ITEMS');
  console.log(`  Total: ${hackathonDataset.items.length}`);
  console.log(
    `  Statuses: ${format(counts(hackathonDataset.items.map((item) => item.status)))}`,
  );
  console.log(
    `  Unmapped: ${hackathonDataset.items.filter((item) => item.sourceMappingReportId === null).length}`,
  );
  console.log('PACKING UNITS');
  console.log(`  Total: ${hackathonDataset.packingUnits.length}`);
  console.log(
    `  Types: ${format(counts(hackathonDataset.packingUnits.map((unit) => unit.packingUnitType)))}`,
  );
  console.log(
    `  Statuses: ${format(counts(hackathonDataset.packingUnits.map((unit) => unit.status)))}`,
  );
  console.log('SHIPMENTS');
  console.log(`  Total: ${hackathonDataset.shipments.length}`);
  console.log(
    `  Statuses: ${format(counts(hackathonDataset.shipments.map((shipment) => shipment.status)))}`,
  );
  console.log('MOVEMENT SCENARIOS (A/B/C/D; state order: not_sent, assigned, transit, arrived, verified)');
  for (const [scenario, label] of [
    ['A', 'One Source -> One Destination'],
    ['B', 'One Source -> Many Destinations'],
    ['C', 'Many Sources -> One Destination'],
    ['D', 'Many Sources -> Many Destinations'],
  ] as const) {
    console.log(`  ${scenario} ${label}: ${format(matrix[scenario])}`);
  }
}

async function selectApplyUsers(db: PrismaClient) {
  const users = await db.user.findMany({
    orderBy: { id: 'asc' },
    take: 2,
  });
  const actor =
    users.find((user) => user.role === 'admin') ??
    (await db.user.findFirst({ orderBy: { id: 'asc' } }));
  const secondaryOwner = users.find((user) => user.id !== actor?.id) ?? null;
  return { actor, secondaryOwner };
}

async function impact(db: PrismaClient): Promise<void> {
  // Keep preflight on one connection at a time for constrained Supabase
  // poolers; the apply transaction remains a single atomic transaction.
  const events = await db.operationEvent.count();
  const requests = await db.operationRequest.count();
  const discrepancies = await db.discrepancy.count();
  const items = await db.item.count();
  const units = await db.packingUnit.count();
  const shipments = await db.shipment.count();
  console.log('\nOperational rows to replace:');
  console.table({
    operation_events: events,
    operation_requests: requests,
    discrepancies,
    items,
    packing_units: units,
    shipments,
  });
  console.log('Users/auth rows to change: 0');
  console.log(
    'User-referenced OrgScopes will be preserved and reconciled by Org code.',
  );
}

async function assertLiveRoleCompatibility(db: PrismaClient): Promise<void> {
  const enumRows = await db.$queryRaw<Array<{ value: string }>>`
    SELECT value::text
    FROM unnest(enum_range(NULL::public.user_role)) AS value
  `;
  const roleValues = new Set(enumRows.map((row) => row.value));
  invariant(
    roleValues.has('admin') &&
      roleValues.has('poc') &&
      roleValues.has('normal'),
    `live user_role enum is incompatible; found ${[...roleValues].join(', ') || 'no values'}. Apply the reviewed role-system migration before seeding`,
  );

  const viewRows = await db.$queryRaw<Array<{ definition: string | null }>>`
    SELECT pg_get_viewdef('public.user_access_profiles'::regclass, true) AS definition
  `;
  const viewDefinition = viewRows[0]?.definition ?? '';
  invariant(
    !viewDefinition.includes('regular_user'),
    'live user_access_profiles still references regular_user; apply the reviewed role-system migration before seeding',
  );
}

async function reconcileScope(
  tx: Prisma.TransactionClient,
  seed: OrgSeed,
): Promise<string> {
  const [fixed, sameCode] = await Promise.all([
    tx.orgScope.findUnique({
      where: { id: seed.id },
      include: { _count: { select: { users: true } } },
    }),
    tx.orgScope.findMany({
      where: { orgCode: seed.orgCode },
      include: { _count: { select: { users: true } } },
      orderBy: { id: 'asc' },
    }),
  ]);
  const referenced = sameCode.filter((scope) => scope._count.users > 0);
  invariant(
    referenced.length <= 1,
    `multiple user-referenced scopes use ${seed.orgCode}`,
  );
  invariant(
    !fixed ||
      fixed._count.users === 0 ||
      fixed.orgCode?.trim() === seed.orgCode,
    `fixed scope ID collision for ${seed.orgCode}`,
  );
  const id = referenced[0]?.id ?? fixed?.id ?? seed.id;
  if (fixed && fixed.id !== id)
    await tx.orgScope.delete({ where: { id: fixed.id } });
  for (const duplicate of sameCode) {
    if (duplicate.id === id || duplicate.id === fixed?.id) continue;
    invariant(
      duplicate._count.users === 0,
      `cannot delete user-referenced scope ${duplicate.id}`,
    );
    await tx.orgScope.delete({ where: { id: duplicate.id } });
  }
  const data = {
    scopeLevel: 'team' as const,
    mador: seed.mador,
    orgCode: seed.orgCode,
    description: seed.description,
    updatedAt: SEED_TIMESTAMP,
  };
  const existing = await tx.orgScope.findUnique({ where: { id } });
  if (existing) await tx.orgScope.update({ where: { id }, data });
  else
    await tx.orgScope.create({
      data: { id, ...data, createdAt: SEED_TIMESTAMP },
    });
  return id;
}

async function verify(db: Db, scopeMap: Map<string, string>): Promise<void> {
  const [scopes, items, units, shipments] = await Promise.all([
    db.orgScope.findMany({ where: { id: { in: [...scopeMap.values()] } } }),
    db.item.findMany({
      where: { id: { in: hackathonDataset.items.map((item) => item.id) } },
    }),
    db.packingUnit.findMany({
      where: {
        id: { in: hackathonDataset.packingUnits.map((unit) => unit.id) },
      },
      include: { items: true },
    }),
    db.shipment.findMany({
      where: {
        id: { in: hackathonDataset.shipments.map((shipment) => shipment.id) },
      },
      include: { packingUnits: true },
    }),
  ]);
  invariant(
    scopes.length === 64 &&
      new Set(scopes.map((scope) => scope.orgCode)).size === 64,
    'persisted Team scopes',
  );
  invariant(items.length === hackathonDataset.items.length, 'persisted Item count');
  const expectedCounts = counts(
    hackathonDataset.items.map((item) => item.status),
  );
  const actualCounts = counts(items.map((item) => item.status));
  invariant(
    Object.entries(expectedCounts).every(
      ([status, count]) => actualCounts[status] === count,
    ),
    'persisted Item statuses',
  );
  invariant(
    items
      .filter((item) => item.status === 'not_sent')
      .every((item) => item.packingUnitId === null),
    'persisted not_sent Items',
  );
  invariant(
    items.filter((item) => item.sourceMappingReportId === null).length === 2,
    'persisted unmapped Items',
  );
  invariant(units.length === hackathonDataset.packingUnits.length, 'persisted PackingUnit count');
  invariant(
    units
      .filter((unit) => unit.packingUnitType === 'personal_carton')
      .every((unit) => unit.items.length === 0),
    'persisted personal cartons',
  );
  invariant(shipments.length === hackathonDataset.shipments.length, 'persisted Shipment count');
  const validChildren: Record<string, PackingUnitStatus> = {
    not_sent: 'assigned_to_shipment',
    sent: 'in_transit',
    arrived: 'arrived_pending_verification',
    verified: 'verified',
  };
  invariant(
    shipments.every(
      (shipment) =>
        shipment.packingUnits.length > 0 &&
        shipment.packingUnits.every(
          (unit) =>
            unit.status === validChildren[shipment.status] &&
            unit.orgScopeId === shipment.orgScopeId,
        ),
    ),
    'persisted Shipment relations',
  );
}

async function apply(
  db: PrismaClient,
  actorId: string,
  secondaryOwnerId: string,
): Promise<Map<string, string>> {
  return db.$transaction(
    async (tx) => {
      await tx.discrepancy.deleteMany();
      await tx.operationEvent.deleteMany();
      await tx.operationRequest.deleteMany();
      await tx.item.deleteMany();
      await tx.packingUnit.deleteMany();
      await tx.shipment.deleteMany();
      const scopeMap = new Map<string, string>();
      for (const scope of hackathonDataset.orgScopes)
        scopeMap.set(scope.id, await reconcileScope(tx, scope));
      const scopeId = (id: string) => {
        const resolved = scopeMap.get(id);
        invariant(resolved, `missing reconciled scope ${id}`);
        return resolved;
      };
      await tx.shipment.createMany({
        data: hackathonDataset.shipments.map((shipment) => ({
          ...shipment,
          orgScopeId: scopeId(shipment.orgScopeId),
          ownerUserId: null,
          createdByUserId: actorId,
          createdAt: SEED_TIMESTAMP,
          updatedAt: SEED_TIMESTAMP,
        })),
      });
      await tx.packingUnit.createMany({
        data: hackathonDataset.packingUnits.map((unit) => ({
          ...unit,
          orgScopeId: scopeId(unit.orgScopeId),
          ownerUserId: null,
          createdByUserId: actorId,
          createdAt: SEED_TIMESTAMP,
          updatedAt: SEED_TIMESTAMP,
        })),
      });
      await tx.item.createMany({
        data: hackathonDataset.items.map((item) => {
          const { scenario: _scenario, ownerSlot, ...persistedItem } = item;
          return {
            ...persistedItem,
            orgScopeId: scopeId(item.orgScopeId),
            ownerUserId: ownerSlot === 'secondary' ? secondaryOwnerId : null,
            createdByUserId: actorId,
            createdAt: SEED_TIMESTAMP,
            updatedAt: SEED_TIMESTAMP,
          };
        }),
      });
      await verify(tx, scopeMap);
      return scopeMap;
    },
    { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 120_000 },
  );
}

async function main(): Promise<void> {
  const mode = modeFrom(process.argv.slice(2));
  validateDefinition();
  summary(mode);
  if (mode === 'dry-run') {
    console.log(
      '\nDRY-RUN complete. No database connection was opened and no rows were changed.',
    );
    return;
  }
  console.log('\nWARNING: APPLY MODE');
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    await assertLiveRoleCompatibility(db);
    const { actor, secondaryOwner } = await selectApplyUsers(db);
    invariant(
      actor,
      'Apply requires an existing User for created_by_user_id; no User was found',
    );
    invariant(
      secondaryOwner,
      'Apply requires a second existing User for the ownership-visibility example; no User was found',
    );
    console.log(
      `Creator reference: existing User ${actor.id} (${actor.email})`,
    );
    await impact(db);
    const scopeMap = await apply(db, actor.id, secondaryOwner.id);
    await verify(db, scopeMap);
    console.log('\nAPPLY committed. Post-commit verification passed.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
