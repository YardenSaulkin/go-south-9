# Go-South-Prod database

The backend uses Prisma to map the existing Supabase PostgreSQL `public` schema to typed application objects. The database already exists; Prisma is a data-access layer, not a database redesign or migration source.

## Initial setup

1. Copy `.env.example` to `.env` in this directory.
2. Copy the Go-South-Prod connection values from the Supabase dashboard into `DATABASE_URL` (and optionally `DIRECT_URL`).
3. Install dependencies with `npm install`.
4. Generate the Prisma client with `npm run db:generate`.
5. Check connectivity with `npm run db:check`.
6. When credentials are available, optionally inspect the existing schema with `npm run db:pull`.

The ORM maps PostgreSQL tables and relationships to typed objects so application code can query `Shipment`, `PackingUnit`, `Item`, and the other entities without writing raw SQL for every operation. The `user_access_profiles` view is read-only in the application model.

Never run `prisma migrate reset`, drop, recreate, or any destructive migration against the Go-South-Prod Supabase project. Database constraints, triggers, verification guards, and role guards remain authoritative in PostgreSQL.
