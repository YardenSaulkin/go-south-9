# Database

## Verification state

The existing model below is based on the supplied DB characterization and Prisma schema. Live Supabase introspection is **not complete**: the configured direct endpoint is unreachable from the execution environment. No schema change has been applied.

## Existing modeled tables

### `org_scopes`

UUID identity; level (`mador`/`team`); optional full eight-digit `org_code`;
optional unit/anaf/team; required mador; description and timestamps. Parent for
Users, Shipments, PackingUnits, Items, and Destinations. When `org_code` is
present it is the authoritative hierarchy (`UU AA MM TT`); legacy rows without
it continue to use their existing textual hierarchy and are explicitly not
guessed or backfilled by application code.

### `destinations` (pending additive model)

UUID identity plus a unique operator-facing `destination_code`, description,
building, floor, room, required organizational scope and creator, timestamps,
and references from PackingUnits. It is the local catalog for the existing/new
destination Packing flow; the catalog is searched server-side and scoped by the
authorized organizational scope.

### `users`

UUID identity, email, nullable first/last name, unique nullable personal number,
role, optional hierarchy fields and scope, optional creator, and timestamps. No
password is stored. Multiple role-specific owner/creator relations are
explicitly named in Prisma.

### `shipments`

Description, lifecycle status, source/destination text and external room identifiers, required scope and creator, optional owner, timestamps, and many PackingUnits.

### `packing_units`

Generic packaging entity; optional Shipment; source/destination; optional
Destination reference; scope, owner, creator; lifecycle status; timestamps; many
Items. `source_description` is a server-derived snapshot of the selected Room
description. `destination_description` remains a JSON snapshot of the committed
Destination details so historical PackingUnits remain understandable if the
catalog later changes.

PackingUnit also stores nullable destination building/floor fields and nullable
source room/mador responsible-person snapshots. These snapshots are historical
completion data, not live joins. The committed `createdBy` User is returned as
the packer, including nullable first name, last name, personal number, and
phone when those columns are populated.

### `items`

Description, optional PackingUnit, lifecycle status, external mapping/room identifiers, source/destination, scope, owner/creator, quantity, and timestamps. External identifiers remain text and have no local foreign keys.

### `user_access_profiles`

Read-only view mapping user role, mador access, creation/view permissions, global-dashboard access, and visibility scope. Application code only reads it.

## Existing enums modeled

- `org_scope_level`: `mador`, `team`
- `user_role`: `admin`, `poc`, `normal` (live Supabase enum)
- `shipment_status`: `not_sent`, `sent`, `arrived`, `verified`
- `packing_unit_status`: `not_sent`, `assigned_to_shipment`, `in_transit`, `arrived_pending_verification`, `verified`
- `item_status`: `not_sent`, `assigned_to_packing_unit`, `in_transit`, `arrived_pending_verification`, `verified`

## Existing database-owned rules requiring live verification

- PackingUnit cannot verify while a child Item is not verified.
- Shipment cannot verify while a child PackingUnit is not verified.
- A verified parent cannot accept or regress a non-verified child.
- Role/scope creation guards match the access profile rules.
- Exact trigger, constraint, and index names are unresolved until introspection succeeds.

## Pending additive model

The unapplied migration at `backend/prisma/migrations/20260922_hackathon_operations/migration.sql` proposes:

- `packing_unit_type` enum and nullable field.
- sequence-backed unique `packing_units.serial_number`.
- packing/shipment idempotency keys.
- `transport_type` and Shipment transport details.
- positive `items.quantity` and bounded `distributed_quantity`.
- `operation_requests` for replay-safe finalization.
- `operation_events` for actor/state audit.
- `discrepancies` for missing Item/PackingUnit quantities without changing movement enums.
- nullable User identity/contact fields for real packer details.
- nullable PackingUnit destination building/floor and responsible-person snapshots.

The separate pending auth migration
`backend/prisma/migrations/20260922_auth_identity_fields/migration.sql` adds
nullable first name, last name, and personal number fields plus a unique index
for non-null personal numbers.

It must not be applied until existing columns/data/indexes have been inspected and a backup/test plan exists.

## Transactions

- Packing: create unit, claim/split Items, and audit atomically.
- Loading: create Shipment, claim units, advance unit/item statuses, and depart atomically.
- Receiving: revalidate Shipment, mark explicit arrivals, record final shortages, update Shipment, and audit atomically.
- Distribution: validate actual quantities, update Items, create shortages, verify eligible parents, and audit atomically.
- Serializable isolation and conditional updates protect stale screens and double claims.

## Prisma mappings

Application names are camelCase and map to existing snake_case tables/columns with `@map`/`@@map`. UUID and timestamptz native types are explicit. The view uses Prisma's `views` preview feature and has no mutation path.

## South Operation integration

No API/ERD contract was found in the repository. Existing provenance fields are the integration boundary:

- `source_mapping_report_id`
- `source_room_id`
- `destination_room_id`

Local manual Items may keep these null. External Group/Room/MappingReport data is not duplicated locally.

Until a real Room catalog/API is supplied, a source Room is resolved from the
existing Item cache by `(org_scope_id, source_room_id)`. Its first available
`source_description` is treated as the local read-only Room description and is
snapshotted server-side during packing. A missing cached Room returns `החדר לא קיים`;
the browser cannot supply or override its description.

For the packing guard, a source room is considered mapped only when at least one
Item in the scope/room has a non-empty `source_mapping_report_id`. This is a
provenance fallback, not a claim that the local database contains the complete
South Operation mapping state.

The completion response reads the committed PackingUnit, its scope, its
createdBy user, its structured destination fields, its optional descriptions,
and its associated Items. Mador and room responsible-person fields are null
until authoritative data exists; the UI renders that unresolved state without
fabricating a person.

## Limitations

- Live tables, indexes, triggers, policies, row counts, and additive-field compatibility are not verified.
- RLS status is unknown.
- Migration behavior and real transaction concurrency have not been integration-tested.
- A working Supabase Connection Pooler URL is required to complete these checks.
