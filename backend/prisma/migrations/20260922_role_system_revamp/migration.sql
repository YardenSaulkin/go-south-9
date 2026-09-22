-- 1. Rename UserRole enum values
ALTER TYPE user_role RENAME VALUE 'super_user' TO 'admin';
ALTER TYPE user_role RENAME VALUE 'logistics_user' TO 'poc';
ALTER TYPE user_role RENAME VALUE 'regular_user' TO 'normal';

-- 2. Org hierarchy level enum + mapping table
DO $$ BEGIN
  CREATE TYPE org_hierarchy_level AS ENUM ('unit', 'anaf', 'mador', 'team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS org_hierarchy_mappings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level       org_hierarchy_level NOT NULL,
  text_value  text NOT NULL,
  code        char(2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, text_value),
  UNIQUE (level, code)
);

-- 3. Add org_code columns
ALTER TABLE org_scopes ADD COLUMN IF NOT EXISTS org_code char(8);
ALTER TABLE users      ADD COLUMN IF NOT EXISTS org_code char(8);

-- 4. Migrate existing hierarchy text → serial codes
-- Units
WITH ranked AS (
  SELECT DISTINCT unit, LPAD(ROW_NUMBER() OVER (ORDER BY unit)::text, 2, '0') AS code
  FROM org_scopes WHERE unit IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'unit', unit, code FROM ranked ON CONFLICT DO NOTHING;

-- Anafs
WITH ranked AS (
  SELECT DISTINCT anaf, LPAD(ROW_NUMBER() OVER (ORDER BY anaf)::text, 2, '0') AS code
  FROM org_scopes WHERE anaf IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'anaf', anaf, code FROM ranked ON CONFLICT DO NOTHING;

-- Madors
WITH ranked AS (
  SELECT DISTINCT mador, LPAD(ROW_NUMBER() OVER (ORDER BY mador)::text, 2, '0') AS code
  FROM org_scopes WHERE mador IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'mador', mador, code FROM ranked ON CONFLICT DO NOTHING;

-- Teams
WITH ranked AS (
  SELECT DISTINCT team, LPAD(ROW_NUMBER() OVER (ORDER BY team)::text, 2, '0') AS code
  FROM org_scopes WHERE team IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'team', team, code FROM ranked ON CONFLICT DO NOTHING;

-- 5. Populate org_scopes.org_code from the mapping table
UPDATE org_scopes os
SET org_code = CONCAT(
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'unit'  AND text_value = os.unit),  '00'),
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'anaf'  AND text_value = os.anaf),  '00'),
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'mador' AND text_value = os.mador), '00'),
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'team'  AND text_value = os.team),  '00')
);

-- 6. Populate users.org_code from their org_scope
UPDATE users u
SET org_code = (SELECT org_code FROM org_scopes os WHERE os.id = u.org_scope_id)
WHERE u.org_scope_id IS NOT NULL;

-- 7. Drop view first (it depends on users.mador), then drop the columns
DROP VIEW IF EXISTS user_access_profiles;

ALTER TABLE users DROP COLUMN IF EXISTS unit;
ALTER TABLE users DROP COLUMN IF EXISTS anaf;
ALTER TABLE users DROP COLUMN IF EXISTS mador;
ALTER TABLE users DROP COLUMN IF EXISTS team;

-- 8. Recreate the user_access_profiles view with new role semantics and POC fields

CREATE VIEW user_access_profiles AS
SELECT
  u.id                                                         AS user_id,
  u.role,
  -- Normal users get text-mador for existing mador-scoped queries
  CASE WHEN u.role = 'normal' THEN s.mador ELSE NULL END       AS access_mador,
  -- POC users get their unit code (first 2 chars of org_code)
  CASE WHEN u.role = 'poc' THEN LEFT(u.org_code, 2) ELSE NULL END AS access_unit_code,
  TRUE                                                          AS can_create_shipments,
  TRUE                                                          AS can_create_packing_units,
  TRUE                                                          AS can_view_shipments,
  TRUE                                                          AS can_view_packing_units,
  (u.role = 'admin')                                            AS can_view_global_shipments_dashboard,
  -- Only POC can mark shipments as verified
  (u.role IN ('poc', 'admin'))                                  AS can_approve_shipments,
  CASE
    WHEN u.role = 'admin' THEN NULL
    WHEN u.role = 'poc'   THEN LEFT(u.org_code, 2)
    ELSE s.mador
  END                                                           AS data_visibility_scope
FROM users u
LEFT JOIN org_scopes s ON s.id = u.org_scope_id;
