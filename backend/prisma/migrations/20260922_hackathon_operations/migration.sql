-- PENDING REVIEW/APPLICATION: this additive migration has not been run against
-- Go-South-Prod because the configured direct database host is unreachable.
-- Inspect existing production data and run Prisma introspection before applying.

DO $$ BEGIN
  CREATE TYPE packing_unit_type AS ENUM (
    'personal_carton', 'professional_carton', 'pallet', 'dolav', 'bulk'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transport_type AS ENUM ('truck', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE discrepancy_kind AS ENUM (
    'missing_packing_unit', 'missing_item', 'excess_item'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE discrepancy_status AS ENUM ('pending', 'resolved', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS packing_unit_serial_number_seq START WITH 1;

ALTER TABLE packing_units
  ADD COLUMN IF NOT EXISTS packing_unit_type packing_unit_type,
  ADD COLUMN IF NOT EXISTS serial_number integer DEFAULT nextval('packing_unit_serial_number_seq'),
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER SEQUENCE packing_unit_serial_number_seq OWNED BY packing_units.serial_number;

CREATE UNIQUE INDEX IF NOT EXISTS packing_units_serial_number_key
  ON packing_units(serial_number) WHERE serial_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS packing_units_idempotency_key_key
  ON packing_units(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS transport_type transport_type,
  ADD COLUMN IF NOT EXISTS transport_description text,
  ADD COLUMN IF NOT EXISTS vehicle_identifier text,
  ADD COLUMN IF NOT EXISTS transport_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS shipments_idempotency_key_key
  ON shipments(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS personal_number text;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS distributed_quantity integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE items ADD CONSTRAINT items_quantity_positive CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE items ADD CONSTRAINT items_distributed_quantity_valid
    CHECK (distributed_quantity >= 0 AND distributed_quantity <= quantity);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS operation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  previous_state jsonb,
  next_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operation_events_entity_idx
  ON operation_events(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind discrepancy_kind NOT NULL,
  status discrepancy_status NOT NULL DEFAULT 'pending',
  shipment_id uuid REFERENCES shipments(id),
  packing_unit_id uuid REFERENCES packing_units(id),
  item_id uuid REFERENCES items(id),
  expected_quantity integer NOT NULL CHECK (expected_quantity >= 0),
  actual_quantity integer NOT NULL CHECK (actual_quantity >= 0),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  finalized_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CHECK (actual_quantity <= expected_quantity)
);

CREATE INDEX IF NOT EXISTS discrepancies_shipment_status_idx
  ON discrepancies(shipment_id, status);
CREATE INDEX IF NOT EXISTS discrepancies_packing_unit_status_idx
  ON discrepancies(packing_unit_id, status);
