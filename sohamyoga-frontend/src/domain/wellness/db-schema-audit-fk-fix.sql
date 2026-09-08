-- Wave 17 fix: wellness_audit.profile_id had no ON DELETE action, which
-- meant delete_health_profile (the admin_destructive tier tool this table
-- exists to audit) could never actually succeed once a profile had any
-- audit history -- every access is logged, so this blocked 100% of
-- real-world deletions. Compliant fix: preserve the audit row (required for
-- HIPAA/PIPEDA retention) but detach it from the now-erased profile.
-- Found live 2026-09-01 building the first real Health Profiles admin UI.

ALTER TABLE wellness_audit DROP CONSTRAINT wellness_audit_profile_id_fkey;
ALTER TABLE wellness_audit ADD CONSTRAINT wellness_audit_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES health_profile (id) ON DELETE SET NULL;
