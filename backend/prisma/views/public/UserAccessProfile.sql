SELECT
  u.id AS user_id,
  u.role,
  CASE
    WHEN (u.role = 'normal' :: user_role) THEN s.mador
    ELSE NULL :: text
  END AS access_mador,
  CASE
    WHEN (u.role = 'poc' :: user_role) THEN "left"((u.org_code) :: text, 2)
    ELSE NULL :: text
  END AS access_unit_code,
  TRUE AS can_create_shipments,
  TRUE AS can_create_packing_units,
  TRUE AS can_view_shipments,
  TRUE AS can_view_packing_units,
  (u.role = 'admin' :: user_role) AS can_view_global_shipments_dashboard,
  (
    u.role = ANY (ARRAY ['poc'::user_role, 'admin'::user_role])
  ) AS can_approve_shipments,
  CASE
    WHEN (u.role = 'admin' :: user_role) THEN NULL :: text
    WHEN (u.role = 'poc' :: user_role) THEN "left"((u.org_code) :: text, 2)
    ELSE s.mador
  END AS data_visibility_scope
FROM
  (
    users u
    LEFT JOIN org_scopes s ON ((s.id = u.org_scope_id))
  );