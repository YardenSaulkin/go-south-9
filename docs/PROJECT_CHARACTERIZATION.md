# Project characterization

## Executive summary

Go South is an operational logistics control system for packing equipment, loading it into transport, receiving it at the destination, and distributing it to final rooms. Its core hierarchy is `Item → PackingUnit → Shipment`, scoped by organization and backed by Supabase PostgreSQL.

## Operational problem

Physical movement creates gaps between expected and actual equipment. Operators need short, explicit flows that prevent double packing, record responsibility, preserve quantities, require physical confirmation, and surface shortages without corrupting lifecycle state.

## System goals

- One DB-backed operational truth from packing through final distribution.
- Fast Hebrew/RTL workflows usable while moving equipment.
- Server-side permissions and state transitions.
- Atomic multi-entity operations and concurrency protection.
- Explicit discrepancy recheck and auditable final confirmation.
- No dependency on the external South Operation API for routine local operation.

## Users and actors

- **admin:** global visibility/dashboard and approval scope, according to the live access-profile view.
- **poc:** unit-scoped access based on the first two digits of `users.org_code`, with approval capability from the live access profile.
- **normal:** mador-scoped access through `users.org_scope_id -> org_scopes`, with permissions supplied by the live access profile.
- **South Operation system:** future upstream source for room/mapping inventory; contract not present.

## End-to-end workflow

1. User signs in or signs up against the DB-backed hackathon auth endpoints.
2. User chooses אריזה והובלה or קבלה ופיזור.
3. Packing selects organizational/room context, type, eligible Items, quantity, and destination.
4. Shipment loading selects ready PackingUnits and transport details, then departs atomically.
5. Receiving shows expected units unconfirmed; operator marks physical arrivals, rechecks shortages, and finalizes.
6. Distribution confirms actual Item quantities at final destination, rechecks shortages, and finalizes.
7. Dashboard reflects current DB state within the user's visibility scope.

## Detailed user flows

### Packing

Unit → Anaf → Mador → optional Team cascades from OrgScope. Room options derive from available Item provenance, while the operator may enter a room identifier when creating a personal carton. Non-personal packing types require a mapped source room and Item selection; a personal carton is a real zero-Item PackingUnit. Confirmation validates scope, mapping, availability, quantities, destination, actor, and idempotency inside a Serializable transaction. The committed response drives the success screen, and Continue retains only source/destination form state.

### Transport

Authorized user selects scope, transport type, vehicle, timestamp, destination, and ready units. One operation creates Shipment, reserves units, advances units/items to transit, and marks the Shipment sent.

### Receiving

Operator selects an active Shipment and explicitly checks arrived units. `סיום פריקה` calculates—but does not persist—shortages. After physical correction, `אישור סופי` changes arrived units and records truly missing units as discrepancies.

### Distribution

Operator selects an arrived unit, enters actual quantity for each Item, previews shortages, and finalizes. Full lines verify; partial lines retain pending state and record missing quantity. Fully verified children may propagate verification upward.

## Database model

See `docs/DATABASE.md`. Existing tables remain canonical; only a pending additive migration supports new operational metadata.

## Status model

See `docs/STATUS_MODEL.md`. Statuses represent movement/verification, while shortages are separate discrepancies.

## Business rules

- Scope and role are rechecked in the backend.
- Items/units are conditionally claimed at commit time.
- Quantities remain positive; actual cannot exceed expected.
- Parent verification requires verified children; DB triggers remain authoritative.
- Preview/recheck does not mark equipment missing.
- Duplicate submissions reuse idempotency keys/results.

## API and server architecture

NestJS controllers → Zod DTO validation/current user → application services → Prisma transactions → PostgreSQL. React never receives a database URL. See `docs/ARCHITECTURE.md` for routes and boundaries.

## Security model

The current email/personal-number login stores the returned User in local
storage and forwards its ID in `x-user-id`. This is explicitly temporary and
is not strong authentication. Server-side authorization still resolves the
User and access profile for protected operations. Production requires verified
SSO/Supabase Auth claims and an RLS review; neither is falsely claimed complete.

## UX architecture

The product uses a quiet industrial control-room visual language: navy/teal structural surfaces, orange primary actions, visible operational counts, explicit two-step discrepancy confirmation, and large controls. All user-facing workflow text is Hebrew and RTL-aware.

## Error handling

Each workflow has loading, disabled submit, empty, validation, server failure, retry where safe, discrepancy, and success states. Errors never include credentials.

## Auditability

Existing creator/owner/timestamps identify responsibility. The pending audit table records actor, entity, action, previous state, next state, and timestamp for core transitions.

## Future extensions

- Replace the hackathon local-storage/`x-user-id` session with SSO/Supabase Auth.
- Review and enable RLS policies.
- Implement the South Operation adapter after receiving its actual API/ERD contract.
- Add discrepancy resolution workflow and notifications.
- Add approved controlled administration with pagination/edit confirmations.
- Add DB-backed integration/E2E automation after connectivity is restored.
