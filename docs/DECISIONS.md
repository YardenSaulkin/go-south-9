# Architectural decisions

## AD-001 — Production database truth is currently unreachable

- **Question:** Can the Prisma model and additive changes be verified against Go-South-Prod now?
- **Conflicting sources:** The task requires real introspection, while the configured direct Supabase endpoint cannot be reached from this environment even outside the sandbox.
- **Decision:** Do not run or apply any migration. Keep the additive SQL clearly marked as pending, and keep runtime claims at `IMPLEMENTED_NOT_VERIFIED` until Daniel supplies a working Supabase Connection Pooler URL or restores direct endpoint reachability.
- **Impact:** Code, Prisma validation, generated types, builds, and unit tests can be verified; production persistence and the end-to-end scenario cannot.

## AD-002 — Organizational hierarchy remains in `org_scopes`

- **Question:** Should Unit, Branch, Section, Team, and Room become new local tables?
- **Conflicting sources:** Older terminology names these concepts independently, while the intentional local schema stores organizational hierarchy in `org_scopes` and external room references as text.
- **Decision:** Do not duplicate hierarchy tables. Cascade Unit → Anaf → Mador → Team from `org_scopes`. Rooms remain external/provenance identifiers on Items and operational records.
- **Impact:** The hierarchy is server-validated through scope ownership. Room metadata remains limited until the South Operation contract is supplied.

## AD-003 — South Operation integration boundary

- **Question:** How should Group → Room → MappingReport data be integrated?
- **Conflicting sources:** The master requirements describe an external API/ERD, but no such specification or implementation exists in this repository.
- **Decision:** Use existing local Items as the resilient operational cache/boundary and preserve `source_mapping_report_id` and `source_room_id`. Do not invent an external endpoint or local Group/Room/MappingReport tables.
- **Impact:** Local operations do not depend on external availability. Automated import remains unresolved until an actual API contract is available.

## AD-004 — Packing-unit type

- **Question:** Where should the required physical package type be stored?
- **Decision:** Add nullable `packing_unit_type` enum to `packing_units`; require it for all newly created units in the application. Existing rows remain nullable until reviewed/backfilled.
- **Impact:** Five product types are explicit without changing the meaning of `PackingUnit` or creating a second packaging entity.

## AD-005 — Quantity and partial operations

- **Question:** Is one Item row always one physical unit, or can it represent grouped quantity?
- **Decision:** Add positive integer `quantity` and bounded `distributed_quantity`. Partial packing transactionally decrements the source row and creates an associated row for the selected quantity, preserving provenance. Distribution stores actual quantity and creates a discrepancy for the remainder.
- **Impact:** `4 + 6 = 10` and `7 + 3 = 10` are preserved. The migration must be inspected against real data before application.

## AD-006 — Structured destination in compatible fields

- **Question:** Are separate building/floor/room columns necessary?
- **Decision:** Keep `destination_room_id` for the external/stable room identifier and store the validated `{building, floor, room, roomId}` DTO as JSON text in `destination_description`.
- **Impact:** No destructive redesign is needed. A future additive normalized destination object remains possible.

## AD-007 — Packing-unit serial

- **Question:** How should five-digit operational labels be generated safely?
- **Decision:** Add a PostgreSQL sequence-backed `serial_number` with a unique index. Display formatting pads it to five digits. Never derive it with `MAX + 1` or in React.
- **Impact:** Concurrent inserts receive unique values after the pending migration is applied.

## AD-008 — Shipment represents transport

- **Question:** Should a separate transport table be introduced?
- **Decision:** Keep `Shipment = הובלה` and add nullable transport type, description, vehicle identifier, timestamp, and idempotency key fields.
- **Impact:** One domain entity owns loading and transport state; no redundant table is introduced.

## AD-009 — Missing equipment is a discrepancy, not a lifecycle status

- **Question:** Should `missing` be added to Item/PackingUnit status enums?
- **Decision:** Preserve current lifecycle enums. Record shortages in `discrepancies` after explicit final confirmation; the missing entity remains at its last physically known lifecycle state.
- **Impact:** Existing verification triggers are not weakened, and discrepancy resolution is auditable independently of movement status.

## AD-010 — Hackathon authentication

- **Question:** How is current user established before SSO exists?
- **Decision:** Use DB-backed email/personal-number login and signup for the hackathon. Persist the returned User locally, send `x-user-id`, resolve it server-side, and load authorization from `user_access_profiles` on every protected request.
- **Impact:** No hardcoded identity or password exists, but the browser-stored User and spoofable header are not production authentication and must be replaced by verified SSO/Supabase Auth claims.

## AD-011 — Idempotency and auditability

- **Decision:** Use unique create-operation idempotency keys plus an `operation_requests` table for receiving/distribution. Record who/when/entity/action/previous/next in `operation_events`.
- **Impact:** Duplicate submissions can be replayed safely after the pending migration; key operational transitions remain traceable.

## AD-012 — Security boundary and RLS

- **Decision:** PostgreSQL credentials stay server-side; React only calls NestJS. Server services enforce user/scope permissions. RLS is not claimed or added in this task because existing policies could not be inspected.
- **Impact:** UI filtering is convenience only. Production deployment still requires real authentication and an RLS/policy review.

## AD-013 — Room mapping guard

- **Question:** How can packing determine whether a source room has a usable mapping without a South Operation API or local Room tables?
- **Decision:** Use existing `items.source_mapping_report_id` provenance as the backend-owned mapping signal. A room is mapped when at least one local Item for that room has a non-empty mapping-report identifier; eligible-Item count is never used as the mapping signal.
- **Impact:** A mapped room remains mapped even when all currently packable Items have been claimed. The rule must be revisited when a real South Operation mapping contract is supplied.

## AD-014 — Personal carton exception

- **Question:** Does a personal carton require mapped Items?
- **Decision:** `personal_carton` is a real `PackingUnit` with zero Items allowed. It still records organizational scope, source room, destination, creator, type, and serial. Non-personal types require completed room mapping and at least one eligible Item.
- **Impact:** The UI clears selected Items when switching to a personal carton, and the server rejects a personal-carton request that contains Items.

## AD-015 — Continue-packing state

- **Question:** What survives after the operator chooses `כן` on the success screen?
- **Decision:** Keep source scope/room and destination in in-memory application state while returning to `/packing`. Reset type, selected Items, quantities, validation messages, success data, and idempotency key by mounting a fresh form. No sensitive state is placed in the URL or local storage.
- **Impact:** Refresh persistence is intentionally not promised for this hackathon flow.

## AD-016 — Completion responsibilities

- **Question:** What should the success screen show when mador/room responsible-person data is absent?
- **Decision:** Return the real packer email from the committed `createdBy` relation and display `לא הוגדר` for responsible-person fields because the current data model has no authoritative source for them.
- **Impact:** No names are fabricated for visual parity.

## AD-017 — Code-backed organizational hierarchy with explicit legacy fallback

- **Decision:** Add nullable `org_scopes.org_code`. A non-null code must be
  exactly eight digits and is parsed centrally as Unit/Anaf/Mador/Team pairs.
  Context responses expose those parsed segments so the client does not duplicate
  parser logic. Rows without a full code remain legacy textual scopes; they are
  filtered by their existing fields and never inferred from partial values.
- **Impact:** Code-backed Team selections use the full eight-digit code, avoiding
  collisions between repeated hierarchy names. Live legacy data must be reviewed
  before any backfill.

## AD-018 — Room cache and destination catalog snapshots

- **Decision:** Source Rooms are resolved from local Item provenance until an
  authoritative Room integration is available. The selected Room must exist in
  the authorized scope and its description is read-only and server-snapshotted.
  Add a scoped Destination catalog for `existing`/`new` destination selection.
  Existing destinations are read only; new destinations and their PackingUnit are
  created in the same serializable transaction. PackingUnits preserve committed
  source and destination snapshots.
- **Impact:** Item visibility is room-based rather than owner-based, while scope
  authorization remains server enforced. The new migration is pending live DB
  introspection and must not be applied blindly.
