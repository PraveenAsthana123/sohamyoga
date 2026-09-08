-- Explicit dimension booleans, per the Module Understanding Standard's
-- mandatory per-dimension tallies (policy section 6). Deliberately explicit
-- columns rather than inferring from user_flow/admin_flow text — text-
-- pattern matching already produced one false positive (Experiments'
-- user_flow describes an *absence* of a distinct screen in prose, which a
-- crude "starts with No" check missed).
ALTER TABLE module_registry ADD COLUMN IF NOT EXISTS has_user_ui BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE module_registry ADD COLUMN IF NOT EXISTS has_admin_ui BOOLEAN NOT NULL DEFAULT FALSE;
-- has_database / has_report / has_dashboard are reliably derivable from
-- existing columns (schema_tables/report_location/dashboard_location) and
-- do not need their own boolean — computed at query time instead.
