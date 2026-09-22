# Architecture

## System architecture

```text
React/Vite (Hebrew RTL)
  └── HTTP /api + x-user-id (temporary hackathon session)
       └── NestJS controllers
            └── Zod validation + current-user resolution
                 └── domain services (permissions, state transitions, transactions)
                      └── Prisma singleton
                           └── Supabase PostgreSQL / public schema

South Operation API (contract unavailable)
  └── future backend adapter/import
       └── Items retain source_mapping_report_id/source_room_id provenance
```

## Frontend

- React 19 with Vite; no second data layer or direct database client.
- `App.tsx` owns navigation, authenticated-route guards, and logout.
- `PackingUnitPage.tsx` implements the focused source → type → items → destination → completion flow.
- `api/client.ts` owns login/signup transport and session headers; `api.ts`
  owns the Packing flow and receives the signed-in user's server-resolved ID.
- `validation.ts` validates form DTOs before submission; the server repeats validation authoritatively.
- UI is Hebrew/RTL, desktop-first and tablet/mobile responsive. Native buttons, labels, selects, checkboxes, live status messages, visible focus, and reduced-motion handling provide the accessibility baseline.

## Backend

- NestJS controllers translate HTTP input only.
- `CurrentUserService` resolves an actual User and `user_access_profiles` row per protected request.
- Services enforce permissions, state, stale-data checks, idempotency, and transaction boundaries.
- Pure domain helpers centralize role checks, valid status transitions, quantity arithmetic, receiving summaries, and serial formatting.
- Repositories from the initial DB task remain available for basic typed access; multi-entity workflows use Prisma interactive transactions in application services because the unit of work spans several repositories.

## API

| Method | Route                                      | Responsibility                                   |
| ------ | ------------------------------------------ | ------------------------------------------------ |
| GET    | `/api/context`                             | Actual demo users and organizational scopes      |
| POST   | `/api/auth/login`                          | Validate credentials and return the matching User |
| POST   | `/api/auth/signup`                         | Validate and create a User and OrgScope membership |
| GET    | `/api/packing-units/eligible-items`        | Available real Items by scope/room               |
| GET    | `/api/packing-units/source-rooms`          | Source-room options from persisted provenance    |
| GET    | `/api/packing-units/mapping-status`        | Backend-owned room mapping status               |
| POST   | `/api/packing-units`                       | Atomic packing and optional quantity split       |
| GET    | `/api/packing-units/eligible-for-shipment` | Units available for loading                      |
| POST   | `/api/shipments`                           | Atomic Shipment creation, loading, and departure |
| GET    | `/api/receiving/shipments`                 | Active Shipments with expected PackingUnits      |
| POST   | `/api/receiving/:shipmentId`               | Preview or finalize receiving discrepancy        |
| GET    | `/api/distribution/packing-units`          | Arrived units awaiting distribution              |
| POST   | `/api/distribution/:packingUnitId`         | Preview or finalize distribution quantities      |
| GET    | `/api/dashboard`                           | DB-derived, permission-scoped operational counts |

## ORM and database

- One ORM: Prisma 6.19.
- `src/lib/db.ts` owns the singleton client.
- Existing production tables remain canonical.
- A pending additive migration contains only fields/tables required by product behavior. It has not been applied because production introspection is blocked.
- No destructive migration, reset, drop, or schema recreation exists.

## Authentication and authorization

- Current mode: temporary login/signup against `users`, persisted in browser local storage.
- Server-visible identity after login: `x-user-id`, validated as UUID and resolved from the DB.
- Authorization: `user_access_profiles` plus target OrgScope mador comparison.
- Future mode: replace the header with verified SSO/Supabase Auth claims while retaining the same `CurrentUser` service contract.

## Validation

- Frontend Zod schemas improve UX.
- Backend Zod schemas validate every mutation DTO.
- IDs, user identity, OrgScope, statuses, current DB availability, quantities, and associations are revalidated server-side.

## Transactions and concurrency

- Packing, loading, receiving finalization, and distribution finalization use Serializable Prisma transactions.
- Conditional `updateMany` claims reject stale/double packing and loading.
- Serial generation is delegated to a PostgreSQL sequence.
- Idempotency keys prevent duplicate create/finalize operations.
- Production concurrency behavior remains unverified until the migration and integration tests can run against PostgreSQL.

## State machine

Arbitrary status dropdowns do not exist. Domain transition functions permit only the documented path; database verification triggers remain authoritative.

## Errors

- Validation and business conflicts return Hebrew messages.
- UI supplies loading, disabled, empty, error, retry, discrepancy/recheck, and success states.
- Prisma connection details and credentials are never rendered.

## Security

- `DATABASE_URL` exists only in backend local environment/processes.
- Frontend has no Supabase service key or PostgreSQL client.
- No raw SQL interface is exposed.
- The local-storage/`x-user-id` identity is explicitly not production authentication.
- RLS status is unknown because live schema/policies could not be inspected.

## Deployment assumptions

- Backend receives `DATABASE_URL`, optional `DIRECT_URL`, `PORT`, and `FRONTEND_ORIGIN` from the runtime.
- Frontend uses same-origin `/api` in production or `VITE_API_URL` when explicitly configured.
- The pending migration must be reviewed, tested, and applied before deploying the new workflows.

## Scaling

- Stateless NestJS instances can share PostgreSQL.
- DB sequences, constraints, isolation, and conditional updates provide cross-instance integrity.
- External imports should be asynchronous/retryable but do not require a new service for the hackathon.
