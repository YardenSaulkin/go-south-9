# Database

## Verification state

The existing model below is based on the supplied DB characterization and Prisma schema. Live Supabase introspection is **not complete**: the configured direct endpoint is unreachable from the execution environment. No schema change has been applied.

## Existing modeled tables

### `org_scopes`

UUID identity; level (`mador`/`team`); optional unit/anaf/team; required mador; description and timestamps. Parent for Users, Shipments, PackingUnits, and Items.

### `users`

UUID identity, email, role, optional hierarchy fields and scope, optional creator, timestamps. No password. Multiple role-specific owner/creator relations are explicitly named in Prisma.

### `shipments`

Description, lifecycle status, source/destination text and external room identifiers, required scope and creator, optional owner, timestamps, and many PackingUnits.

### `packing_units`

Generic packaging entity; optional Shipment; source/destination; scope, owner, creator; lifecycle status; timestamps; many Items.

### `items`

Description, optional PackingUnit, lifecycle status, external mapping/room identifiers, source/destination, scope, owner/creator, quantity, and timestamps. External identifiers remain text and have no local foreign keys.

### `user_access_profiles`

Read-only view mapping user role, mador access, creation/view permissions, global-dashboard access, and visibility scope. Application code only reads it.

## Existing enums modeled

- `org_scope_level`: `mador`, `team`
- `user_role`: `super_user`, `logistics_user`, `regular_user`
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

For the packing guard, a source room is considered mapped only when at least one
Item in the scope/room has a non-empty `source_mapping_report_id`. This is a
provenance fallback, not a claim that the local database contains the complete
South Operation mapping state.

The completion response reads the committed PackingUnit, its scope, its
createdBy user, its persisted destination JSON, and its associated Items. Mador
and room responsible-person fields are intentionally returned as `לא הוגדר`
until authoritative data exists.

## Limitations

- Live tables, indexes, triggers, policies, row counts, and additive-field compatibility are not verified.
- RLS status is unknown.
- Migration behavior and real transaction concurrency have not been integration-tested.
- A working Supabase Connection Pooler URL is required to complete these checks.
