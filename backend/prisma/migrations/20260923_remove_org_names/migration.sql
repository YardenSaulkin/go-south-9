-- Drop view that depends on org_scopes columns
DROP VIEW IF EXISTS user_access_profiles;

-- Migrate mador column to store the 2-digit code instead of the text name
UPDATE org_scopes
SET mador = SUBSTRING(org_code, 5, 2)
WHERE org_code IS NOT NULL AND length(org_code) = 8;

-- Drop text name columns (unit, anaf, team) — mador is kept as the 2-digit code
ALTER TABLE org_scopes DROP COLUMN IF EXISTS unit;
ALTER TABLE org_scopes DROP COLUMN IF EXISTS anaf;
ALTER TABLE org_scopes DROP COLUMN IF EXISTS team;

-- Drop the name-to-code mapping table and its enum — no longer needed
DROP TABLE IF EXISTS org_hierarchy_mappings;
DROP TYPE IF EXISTS org_hierarchy_level;

-- Recreate user_access_profiles with mador code semantics
CREATE VIEW user_access_profiles AS
SELECT
  u.id                                                         AS user_id,
  u.role,
  CASE WHEN u.role = 'normal' THEN s.mador ELSE NULL END       AS access_mador,
  CASE WHEN u.role = 'poc' THEN LEFT(u.org_code, 2) ELSE NULL END AS access_unit_code,
  TRUE                                                          AS can_create_shipments,
  TRUE                                                          AS can_create_packing_units,
  TRUE                                                          AS can_view_shipments,
  TRUE                                                          AS can_view_packing_units,
  (u.role = 'admin')                                            AS can_view_global_shipments_dashboard,
  (u.role IN ('poc', 'admin'))                                  AS can_approve_shipments,
  CASE
    WHEN u.role = 'admin' THEN NULL
    WHEN u.role = 'poc'   THEN LEFT(u.org_code, 2)
    ELSE s.mador
  END                                                           AS data_visibility_scope
FROM users u
LEFT JOIN org_scopes s ON s.id = u.org_scope_id;
