import type {
  ItemStatus,
  PackingUnitStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  SEED_NAME,
  SEED_TIMESTAMP,
  hackathonDataset,
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

function coverage() {
  const bySource = new Map<string, Set<string>>();
  const byDestination = new Map<string, Set<string>>();
  for (const item of hackathonDataset.items) {
    const destinations = bySource.get(item.sourceRoomId) ?? new Set<string>();
    destinations.add(item.destinationRoomId);
    bySource.set(item.sourceRoomId, destinations);
    const sources =
      byDestination.get(item.destinationRoomId) ?? new Set<string>();
    sources.add(item.sourceRoomId);
    byDestination.set(item.destinationRoomId, sources);
  }
  const general = [...bySource.entries()].filter(
    ([source]) =>
      !hackathonDataset.rooms.slice(0, 4).some((room) => room.id === source),
  );
  return {
    oneToOne: [...bySource.values()].some(
      (destinations) => destinations.size === 1,
    ),
    oneToMany: [...bySource.values()].some(
      (destinations) => destinations.size > 1,
    ),
    manyToOne: [...byDestination.values()].some((sources) => sources.size > 1),
    manyToMany:
      general.length > 1 &&
      new Set(general.flatMap(([, destinations]) => [...destinations])).size >
        1,
  };
}

function validateDefinition(): void {
  const hierarchy = hierarchyCounts();
  invariant(
    hierarchy.units === 4 &&
      hierarchy.anafim === 8 &&
      hierarchy.madors === 14 &&
      hierarchy.teams === 32,
    'hierarchy must be 4 Units / 8 Anafim / 14 Madors / 32 Teams',
  );
  const expectedUnits = [
    ['יחידת מבצעים', 3, 5, 12],
    ['יחידת תקשוב', 2, 4, 9],
    ['יחידת מודיעין', 2, 3, 7],
    ['יחידת מנהלה', 1, 2, 4],
  ] as const;
  for (const [unit, anafim, madors, teams] of expectedUnits) {
    const scopes = hackathonDataset.orgScopes.filter(
      (scope) => scope.unit === unit,
    );
    invariant(
      new Set(scopes.map((scope) => scope.anaf)).size === anafim,
      `${unit} Anaf count`,
    );
    invariant(
      new Set(scopes.map((scope) => `${scope.anaf}\0${scope.mador}`)).size ===
        madors,
      `${unit} Mador count`,
    );
    invariant(scopes.length === teams, `${unit} Team count`);
  }
  invariant(
    new Set(hackathonDataset.orgScopes.map((scope) => scope.orgCode)).size ===
      32 &&
      hackathonDataset.orgScopes.every((scope) =>
        /^\d{8}$/.test(scope.orgCode),
      ),
    'Team Org codes must be unique 8-digit values',
  );
  invariant(hackathonDataset.rooms.length === 32, 'expected 32 source Rooms');
  const reports = hackathonDataset.rooms.flatMap((room) =>
    room.mappingReportId ? [room.mappingReportId] : [],
  );
  invariant(
    reports.length === 31 &&
      new Set(reports).size === 31 &&
      reports[0] === 'report-000001',
    'MappingReport sequence',
  );
  invariant(
    hackathonDataset.destinations.length === 12,
    'expected 12 destinations',
  );
  invariant(
    new Set(hackathonDataset.destinations.map((destination) => destination.id))
      .size === 12,
    'destination IDs must be unique',
  );

  invariant(hackathonDataset.items.length === 64, 'expected 64 Items');
  const itemCounts = counts(hackathonDataset.items.map((item) => item.status));
  const expectedItems: Record<string, number> = {
    not_sent: 48,
    assigned_to_packing_unit: 6,
    in_transit: 4,
    arrived_pending_verification: 3,
    verified: 3,
  };
  invariant(
    Object.entries(expectedItems).every(
      ([status, count]) => itemCounts[status] === count,
    ),
    'Item status distribution',
  );
  const unmapped = hackathonDataset.items.filter(
    (item) => item.sourceMappingReportId === null,
  );
  invariant(
    unmapped.length === 2 &&
      new Set(unmapped.map((item) => item.sourceRoomId)).size === 1,
    'exactly 2 isolated unmapped Items',
  );
  invariant(
    hackathonDataset.items
      .filter((item) => item.status === 'not_sent')
      .every(
        (item) => item.packingUnitId === null && item.distributedQuantity === 0,
      ),
    'not_sent Items must be unpacked and undistributed',
  );
  invariant(
    hackathonDataset.orgScopes.every((scope) =>
      hackathonDataset.items.some((item) => item.orgScopeId === scope.id),
    ),
    'every Team must own at least one Item',
  );
  invariant(
    hackathonDataset.items.every(
      (item) =>
        item.quantity > 0 &&
        item.distributedQuantity >= 0 &&
        item.distributedQuantity <= item.quantity,
    ),
    'Item quantity constraints',
  );

  invariant(
    hackathonDataset.packingUnits.length === 12,
    'expected 12 PackingUnits',
  );
  invariant(
    new Set(hackathonDataset.packingUnits.map((unit) => unit.packingUnitType))
      .size === 5,
    'all PackingUnit types',
  );
  const personal = hackathonDataset.packingUnits.filter(
    (unit) => unit.packingUnitType === 'personal_carton',
  );
  invariant(personal.length === 2, 'expected 2 personal cartons');
  invariant(
    personal.every(
      (unit) =>
        !hackathonDataset.items.some((item) => item.packingUnitId === unit.id),
    ),
    'personal cartons must be empty',
  );
  const parentStatus: Partial<Record<ItemStatus, PackingUnitStatus>> = {
    assigned_to_packing_unit: 'assigned_to_shipment',
    in_transit: 'in_transit',
    arrived_pending_verification: 'arrived_pending_verification',
    verified: 'verified',
  };
  for (const item of hackathonDataset.items.filter(
    (item) => item.status !== 'not_sent',
  )) {
    const parent = hackathonDataset.packingUnits.find(
      (unit) => unit.id === item.packingUnitId,
    );
    invariant(
      parent && parent.status === parentStatus[item.status],
      `Item ${item.id} parent status`,
    );
    invariant(
      parent.packingUnitType !== 'personal_carton' &&
        parent.orgScopeId === item.orgScopeId,
      `Item ${item.id} parent relation`,
    );
  }

  invariant(hackathonDataset.shipments.length === 4, 'expected 4 Shipments');
  const shipmentStatus: Record<PackingUnitStatus, string | null> = {
    not_sent: null,
    assigned_to_shipment: 'not_sent',
    in_transit: 'sent',
    arrived_pending_verification: 'arrived',
    verified: 'verified',
  };
  for (const unit of hackathonDataset.packingUnits) {
    const expected = shipmentStatus[unit.status];
    if (expected === null)
      invariant(unit.shipmentId === null, `${unit.id} must be standalone`);
    else {
      const shipment = hackathonDataset.shipments.find(
        (row) => row.id === unit.shipmentId,
      );
      invariant(
        shipment?.status === expected &&
          shipment.orgScopeId === unit.orgScopeId,
        `${unit.id} Shipment relation`,
      );
    }
  }
  invariant(
    Object.values(coverage()).every(Boolean),
    'all four source/destination scenarios',
  );
}

function summary(mode: Mode): void {
  const hierarchy = hierarchyCounts();
  const scenarios = coverage();
  const format = (value: Record<string, number>) =>
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => `${key}=${count}`)
      .join(', ');
  console.log(`\n${SEED_NAME}`);
  console.log(
    `Mode: ${mode === 'apply' ? 'APPLY' : 'DRY-RUN (no database connection or mutation)'}`,
  );
  console.log(`Units: ${hierarchy.units}`);
  console.log(`Anafim: ${hierarchy.anafim}`);
  console.log(`Madors: ${hierarchy.madors}`);
  console.log(`Teams: ${hierarchy.teams}`);
  console.log(`Source Rooms: ${hackathonDataset.rooms.length}`);
  console.log(
    `Destinations (canonical snapshots; no current table): ${hackathonDataset.destinations.length}`,
  );
  console.log(
    `MappingReports: ${new Set(hackathonDataset.items.flatMap((item) => (item.sourceMappingReportId ? [item.sourceMappingReportId] : []))).size}`,
  );
  console.log(`Items: ${hackathonDataset.items.length}`);
  console.log(
    `Item statuses: ${format(counts(hackathonDataset.items.map((item) => item.status)))}`,
  );
  console.log(
    `Unmapped Items: ${hackathonDataset.items.filter((item) => item.sourceMappingReportId === null).length}`,
  );
  console.log(`PackingUnits: ${hackathonDataset.packingUnits.length}`);
  console.log(
    `PackingUnit types: ${format(counts(hackathonDataset.packingUnits.map((unit) => unit.packingUnitType)))}`,
  );
  console.log(
    `PackingUnit statuses: ${format(counts(hackathonDataset.packingUnits.map((unit) => unit.status)))}`,
  );
  console.log(`Shipments: ${hackathonDataset.shipments.length}`);
  console.log(
    `Shipment statuses: ${format(counts(hackathonDataset.shipments.map((shipment) => shipment.status)))}`,
  );
  console.log('Scenario coverage:');
  console.log(
    `  one source -> one destination: ${scenarios.oneToOne ? 'yes' : 'no'}`,
  );
  console.log(
    `  one source -> many destinations: ${scenarios.oneToMany ? 'yes' : 'no'}`,
  );
  console.log(
    `  many sources -> one destination: ${scenarios.manyToOne ? 'yes' : 'no'}`,
  );
  console.log(
    `  many sources -> many destinations: ${scenarios.manyToMany ? 'yes' : 'no'}`,
  );
}

async function selectActor(db: PrismaClient) {
  return (
    (await db.user.findFirst({
      where: { role: 'admin' },
      orderBy: { id: 'asc' },
    })) ?? db.user.findFirst({ orderBy: { id: 'asc' } })
  );
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
    scopes.length === 32 &&
      new Set(scopes.map((scope) => scope.orgCode)).size === 32,
    'persisted Team scopes',
  );
  invariant(items.length === 64, 'persisted Item count');
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
  invariant(units.length === 12, 'persisted PackingUnit count');
  invariant(
    units
      .filter((unit) => unit.packingUnitType === 'personal_carton')
      .every((unit) => unit.items.length === 0),
    'persisted personal cartons',
  );
  invariant(shipments.length === 4, 'persisted Shipment count');
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
        data: hackathonDataset.items.map((item) => ({
          ...item,
          orgScopeId: scopeId(item.orgScopeId),
          ownerUserId: null,
          createdByUserId: actorId,
          createdAt: SEED_TIMESTAMP,
          updatedAt: SEED_TIMESTAMP,
        })),
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
    const actor = await selectActor(db);
    invariant(
      actor,
      'Apply requires an existing User for created_by_user_id; no User was found',
    );
    console.log(
      `Creator reference: existing User ${actor.id} (${actor.email})`,
    );
    await impact(db);
    const scopeMap = await apply(db, actor.id);
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
