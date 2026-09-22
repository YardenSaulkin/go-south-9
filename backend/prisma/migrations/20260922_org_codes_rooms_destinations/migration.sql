-- PENDING REVIEW/APPLICATION: live database introspection was unavailable when
-- this additive migration was authored. Do not apply before reviewing existing
-- production schemas, data, indexes, and backup/rollback procedures.

-- Full organizational hierarchy codes are optional for legacy scopes. New code
-- values must be exactly eight digits (unit/anaf/mador/team, two digits each).
ALTER TABLE org_scopes ADD COLUMN IF NOT EXISTS org_code text;

DO $$ BEGIN
  ALTER TABLE org_scopes
    ADD CONSTRAINT org_scopes_org_code_format_check
    CHECK (org_code IS NULL OR org_code ~ '^[0-9]{8}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS org_scopes_org_code_key
  ON org_scopes(org_code) WHERE org_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_code text NOT NULL UNIQUE,
  description text NOT NULL,
  building text NOT NULL,
  floor text NOT NULL,
  room text NOT NULL,
  org_scope_id uuid NOT NULL REFERENCES org_scopes(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS destinations_scope_description_idx
  ON destinations(org_scope_id, description);

ALTER TABLE packing_units
  ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES destinations(id);

CREATE INDEX IF NOT EXISTS packing_units_destination_id_idx
  ON packing_units(destination_id);
