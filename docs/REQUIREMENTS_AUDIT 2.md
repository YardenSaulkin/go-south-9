# Master requirements audit

Statuses describe repository evidence as of 2026-09-22. `IMPLEMENTED_NOT_VERIFIED` means code/build evidence exists but production DB or manual E2E verification is blocked. The live Supabase endpoint is unreachable; no migration has been applied.

| ID      | Requirement                                                 | Status                   | Evidence                                                                                         | Missing Work / Decision                                                          |
| ------- | ----------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| HACK-00 | Git safety and implementation branch                        | VERIFIED_IMPLEMENTED     | `Daniel/full-app`; initial status/log inspected; no reset/push/merge                             | None                                                                             |
| HACK-01 | Full traceability audit                                     | VERIFIED_IMPLEMENTED     | `docs/REQUIREMENTS_AUDIT.md`                                                                     | Keep synchronized after DB verification                                          |
| HACK-02 | Source-of-truth priority and conflict handling              | PARTIAL                  | Repo/material inventory; `docs/DECISIONS.md`                                                     | Actual DB and South API/ERD unavailable                                          |
| HACK-03 | Real DB connectivity/introspection first                    | MISSING                  | `npm run db:check` attempted with normalized local URL; endpoint unreachable                     | Supply working Supabase pooler URL, introspect, reconcile, apply nothing blindly |
| HACK-04 | Core DB/domain hierarchy                                    | IMPLEMENTED_NOT_VERIFIED | `backend/prisma/schema.prisma`; repositories/services                                            | Compare to live introspection                                                    |
| HACK-05 | Database verification guards                                | PARTIAL                  | Domain guard tests; documented expected DB triggers                                              | Inspect and integration-test real triggers                                       |
| HACK-06 | Role and mador permissions                                  | IMPLEMENTED_NOT_VERIFIED | `permissions.ts`; `CurrentUserService`; protected services                                       | Exercise against real access-profile rows                                        |
| HACK-07 | Current user / hackathon auth                               | IMPLEMENTED_NOT_VERIFIED | DB-backed login/signup; local session; `x-user-id`; server resolution                             | Live DB smoke test pending; replace with SSO later                               |
| HACK-08 | Required project documentation                              | VERIFIED_IMPLEMENTED     | Five required `docs/*.md` files                                                                  | Update after introspection                                                       |
| HACK-09 | UI/API/service/validation/data separation                   | VERIFIED_IMPLEMENTED     | frontend `api.ts`; controllers; services; domain; Prisma                                         | None                                                                             |
| HACK-10 | Hebrew RTL operational home                                 | VERIFIED_IMPLEMENTED     | `frontend/src/App.tsx`, CSS, Hebrew HTML metadata                                                | Browser QA still desirable                                                       |
| HACK-11 | Packing organizational/room cascade                         | IMPLEMENTED_NOT_VERIFIED | `ScopeSelector`; eligible-items API; server scope check                                          | Real rooms/data manual verification                                              |
| HACK-12 | South Operation integration                                 | PARTIAL                  | Provenance fields retained; AD-003                                                               | Actual API/ERD contract and import adapter absent                                |
| HACK-13 | Required PackingUnit types                                  | IMPLEMENTED_NOT_VERIFIED | Prisma enum, pending migration, UI selector, backend schema                                      | Apply/verify additive migration                                                  |
| HACK-14 | Item eligibility / source classifications                   | PARTIAL                  | Only local `not_sent` and unassigned Items are eligible                                          | Source labels להעברה/להנצלה/לגריטה unavailable; model after API contract         |
| HACK-15 | Quantity-aware packing/distribution                         | IMPLEMENTED_NOT_VERIFIED | quantity fields; split transaction; quantity tests                                               | Apply migration and DB integration test                                          |
| HACK-16 | Atomic packing confirmation                                 | IMPLEMENTED_NOT_VERIFIED | `PackingService.create`; Serializable transaction; conditional claim                             | Real DB write/concurrency test                                                   |
| HACK-17 | Structured destination                                      | IMPLEMENTED_NOT_VERIFIED | shared destination DTO; JSON text + room ID; AD-006                                              | Real persistence verification                                                    |
| HACK-18 | Sequential unique five-digit serial                         | IMPLEMENTED_NOT_VERIFIED | DB sequence/unique index migration; `formatSerial` test                                          | Apply migration and concurrent insert test                                       |
| HACK-19 | Packing success summary                                     | IMPLEMENTED_NOT_VERIFIED | Packing UI success message with serial/destination                                               | Manual DB-backed UI test                                                         |
| HACK-20 | Shipment transport details                                  | IMPLEMENTED_NOT_VERIFIED | Shipment additive fields, API validation, Hebrew form                                            | Apply migration and real write test                                              |
| HACK-21 | Atomic finish loading                                       | IMPLEMENTED_NOT_VERIFIED | `ShipmentService.createAndLoad`; conditional claims; transaction                                 | DB integration/concurrency test                                                  |
| HACK-22 | Receiving shows active Shipments/expected unconfirmed units | IMPLEMENTED_NOT_VERIFIED | Receiving API/UI; checkboxes default false                                                       | Manual real-data verification                                                    |
| HACK-23 | Finish unloading                                            | IMPLEMENTED_NOT_VERIFIED | Preview call calculates expected/arrived/missing without mutation                                | Manual workflow verification                                                     |
| HACK-24 | Missing PackingUnit recheck/finalization                    | IMPLEMENTED_NOT_VERIFIED | two-step UI; discrepancies table/service; AD-009                                                 | Apply migration and verify final rows                                            |
| HACK-25 | Receiving summary from DB                                   | IMPLEMENTED_NOT_VERIFIED | receiving response/UI counts from queried associations                                           | Real DB verification                                                             |
| HACK-26 | Distribution flow                                           | IMPLEMENTED_NOT_VERIFIED | Distribution API/UI with Item lines and destinations                                             | Manual DB-backed verification                                                    |
| HACK-27 | Partial distribution quantity                               | IMPLEMENTED_NOT_VERIFIED | `distributedQuantity`; shortage preservation and tests                                           | Apply migration and DB integration test                                          |
| HACK-28 | Distribution discrepancy recheck                            | IMPLEMENTED_NOT_VERIFIED | preview → correction → final confirmation                                                        | Manual workflow verification                                                     |
| HACK-29 | Distribution summary/excess handling                        | IMPLEMENTED_NOT_VERIFIED | computed summary; excess rejection message                                                       | Manual workflow verification                                                     |
| HACK-30 | Explicit status state machine                               | VERIFIED_IMPLEMENTED     | `status-transitions.ts`; unit tests; no status dropdowns                                         | DB trigger integration still under HACK-05                                       |
| HACK-31 | Permission-scoped real dashboard                            | IMPLEMENTED_NOT_VERIFIED | aggregate Prisma queries; dashboard UI; no constants                                             | Real DB/API verification                                                         |
| HACK-32 | Controlled data management                                  | MISSING                  | None                                                                                             | P1 admin search/filter/page/edit experience remains                              |
| HACK-33 | Hebrew/RTL serious operational frontend                     | VERIFIED_IMPLEMENTED     | all implemented UI text/HTML/CSS; production build                                               | Browser visual QA pending                                                        |
| HACK-34 | Desktop/tablet responsive UX                                | VERIFIED_IMPLEMENTED     | responsive grids/nav/forms at 1100/760 px                                                        | Physical device QA pending                                                       |
| HACK-35 | Accessibility                                               | PARTIAL                  | semantic controls, labels, aria-live, focus, text+icons, reduced motion                          | Automated audit and keyboard/screen-reader manual pass pending                   |
| HACK-36 | Frontend and backend schema validation                      | VERIFIED_IMPLEMENTED     | Zod schemas in both applications                                                                 | None                                                                             |
| HACK-37 | Loading/error/success/retry/empty/duplicate UX              | PARTIAL                  | Core flows implement states and server idempotency                                               | Not every fetch has dedicated retry button/dialog                                |
| HACK-38 | Concurrency safety                                          | IMPLEMENTED_NOT_VERIFIED | Serializable transactions; conditional claims; sequence                                          | Real concurrent PostgreSQL tests blocked                                         |
| HACK-39 | Idempotency/double submission                               | IMPLEMENTED_NOT_VERIFIED | unique keys and `operation_requests`; disabled UI                                                | Apply migration and concurrent replay test                                       |
| HACK-40 | Atomic transactions                                         | IMPLEMENTED_NOT_VERIFIED | all four mutation services use interactive transactions                                          | Real rollback tests blocked                                                      |
| HACK-41 | Auditability                                                | IMPLEMENTED_NOT_VERIFIED | creator/owner fields plus pending `operation_events`                                             | Apply migration and query audit trail                                            |
| HACK-42 | Server-only DB/security boundary                            | VERIFIED_IMPLEMENTED     | no frontend DB client/secret; protected API services; security docs                              | Production auth/RLS remain documented limitations                                |
| HACK-43 | Real data only                                              | VERIFIED_IMPLEMENTED     | no seeds/mocks/fixture metrics in UI; all lists call API                                         | DB unavailable means UI empty/error in this environment                          |
| HACK-44 | Functional non-static product                               | IMPLEMENTED_NOT_VERIFIED | working API calls and mutation paths for all core flows                                          | Full manual flow blocked by DB/migration                                         |
| HACK-45 | Dangerous-logic tests                                       | PARTIAL                  | permission, transitions, guards, split, stale claim, serial format, receiving/distribution tests | DB integration, true concurrent serial/claim, service integration tests blocked  |
| HACK-46 | Baseline `supertest/types` typecheck issue                  | VERIFIED_IMPLEMENTED     | invalid internal type import removed; full backend typecheck to be run in quality gate           | None expected                                                                    |
| HACK-47 | Full 38-step manual E2E                                     | MISSING                  | Cannot enter app with DB unreachable                                                             | Restore DB connectivity, review/apply migration, execute scenario                |
| HACK-48 | Complete quality gate                                       | PARTIAL                  | Prisma validate/generate and both builds run during implementation                               | Final lint/typecheck/tests; DB/E2E remain blocked                                |
| HACK-49 | Implement rather than audit-only                            | VERIFIED_IMPLEMENTED     | Backend domain/API plus operational frontend implemented                                         | Remaining blockers listed, not deferred silently                                 |
| HACK-50 | Avoid over-engineering                                      | VERIFIED_IMPLEMENTED     | Single NestJS backend, React frontend, Prisma/PostgreSQL; no extra service/table hierarchy       | None                                                                             |

## Coverage counts

- Total audited: **51**
- `VERIFIED_IMPLEMENTED`: **14**
- `IMPLEMENTED_NOT_VERIFIED`: **26**
- `PARTIAL`: **8**
- `MISSING`: **3**
- `CONFLICT`: **0**
- `NOT_APPLICABLE`: **0**

## Packing-flow task addendum (2026-09-22)

- The focused Packing page now calls the backend for context, source rooms,
  mapping status, eligible Items, and creation; hardcoded packing fixtures were
  removed from that flow.
- `personal_carton` permits zero Items and clears stale selections in the UI;
  the backend rejects Item payloads for that type.
- Non-personal creation checks mapping provenance, Item eligibility, source-room
  ownership, quantities, Serializable claiming, and idempotency.
- Completion data is returned from the committed database row and includes the
  formatted serial, source, destination, item count, and packer. Responsible
  person fields remain `לא הוגדר` because no authoritative source exists.
- Live DB introspection, DB writes, API E2E, and manual browser verification
  remain blocked by the unreachable configured Supabase pooler. No migration
  was applied.

## Packing UI restoration and data-model addendum (2026-09-22)

- The previous approved Packing composition was restored from the parent of
  `f640825`: desert background, centered RTL header/back arrow, translucent
  rounded cards, pill selectors, grouped Item cards, and fixed bottom action.
- The restored component keeps the newer live context, hierarchy cascade,
  source-room loading, mapping guard, personal-carton exception, grouped Item
  quantities, descriptions, idempotent POST, and success/Continue routing.
- Completion data now distinguishes structured source/destination from free
  text, includes the committed main description, returns `responsiblePeople`
  and real packer details, and snapshots responsible-person fields as null when
  no authoritative source is available.
- The status lifecycle remains explicit; zero-Item personal cartons require
  explicit verification at distribution finalization.
- Visual browser inspection at 375/390/393/430px, tablet, and desktop is not
  claimed here because the browser provider is unavailable in this environment.
