-- PENDING REVIEW/APPLICATION: the role-system migration owns org_code and the
-- organizational hierarchy. This additive Packing migration only introduces
-- the Destination catalog. PackingUnits retain an immutable destination code
-- and JSON snapshot in their existing destination fields.

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
