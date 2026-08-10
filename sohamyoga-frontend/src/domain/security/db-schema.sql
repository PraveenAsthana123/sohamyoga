-- =============================================================================
-- Security & RBAC Schema
-- Table-driven: ref_* for enum codes
-- Tenant-driven: tenant_id on every domain table
-- Run AFTER: src/domain/core/db-foundation.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS ref_admin_role (
  code        VARCHAR(30) PRIMARY KEY,
  label       VARCHAR(60) NOT NULL,
  risk_level  SMALLINT NOT NULL DEFAULT 1,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO ref_admin_role (code, label, risk_level, sort_order) VALUES
  ('super_admin',   'Super Admin',   4, 1),
  ('admin',         'Admin',         3, 2),
  ('manager',       'Manager',       3, 3),
  ('finance',       'Finance',       3, 4),
  ('marketing',     'Marketing',     2, 5),
  ('content',       'Content',       2, 6),
  ('support',       'Support',       2, 7),
  ('teacher',       'Teacher',       1, 8),
  ('receptionist',  'Receptionist',  1, 9),
  ('student',       'Student',       1, 10)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_permission_action (
  code       VARCHAR(20) PRIMARY KEY,
  label      VARCHAR(40) NOT NULL,
  is_write   BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO ref_permission_action (code, label, is_write) VALUES
  ('read',    'Read',    FALSE),
  ('create',  'Create',  TRUE),
  ('update',  'Update',  TRUE),
  ('delete',  'Delete',  TRUE),
  ('approve', 'Approve', TRUE),
  ('export',  'Export',  FALSE)
ON CONFLICT (code) DO NOTHING;

-- ─── Role Permissions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permission (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  role        VARCHAR(30)  NOT NULL REFERENCES ref_admin_role(code),
  resource    VARCHAR(100) NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  granted_by  VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role, resource)
);

CREATE INDEX IF NOT EXISTS idx_rp_tenant    ON role_permission(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rp_role      ON role_permission(role);
CREATE INDEX IF NOT EXISTS idx_rp_resource  ON role_permission(resource);
CREATE INDEX IF NOT EXISTS idx_rp_active    ON role_permission(is_active);

CREATE TABLE IF NOT EXISTS role_permission_action (
  permission_id UUID        NOT NULL REFERENCES role_permission(id) ON DELETE CASCADE,
  action        VARCHAR(20) NOT NULL REFERENCES ref_permission_action(code),
  PRIMARY KEY (permission_id, action)
);

-- ─── Security Events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_security_event_type (
  code       VARCHAR(40) PRIMARY KEY,
  label      VARCHAR(80) NOT NULL,
  severity   VARCHAR(10) NOT NULL CHECK (severity IN ('info','warn','critical'))
);
INSERT INTO ref_security_event_type (code, label, severity) VALUES
  ('login_success',      'Successful Login',             'info'),
  ('login_failed',       'Failed Login Attempt',         'warn'),
  ('login_suspicious',   'Suspicious Login (geo/device)','warn'),
  ('account_locked',     'Account Locked',               'warn'),
  ('mfa_enabled',        'MFA Enabled',                  'info'),
  ('mfa_disabled',       'MFA Disabled',                 'warn'),
  ('password_changed',   'Password Changed',             'info'),
  ('role_granted',       'Role Granted',                 'warn'),
  ('role_revoked',       'Role Revoked',                 'warn'),
  ('permission_changed', 'Permission Changed',           'warn'),
  ('session_revoked',    'Session Revoked',              'warn'),
  ('prompt_injection',   'Prompt Injection Detected',    'critical'),
  ('data_export',        'Bulk Data Export',             'warn'),
  ('gdpr_delete',        'GDPR Deletion Request',        'warn'),
  ('api_abuse',          'API Rate Limit Exceeded',      'critical')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS security_event (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  event_type  VARCHAR(40)  NOT NULL REFERENCES ref_security_event_type(code),
  actor_id    UUID,
  actor_email VARCHAR(254),
  actor_ip    INET,
  actor_device TEXT,
  target_id   UUID,
  target_type VARCHAR(40),
  metadata    JSONB,
  resolved    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_event_tenant   ON security_event(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sec_event_type     ON security_event(event_type);
CREATE INDEX IF NOT EXISTS idx_sec_event_actor    ON security_event(actor_id);
CREATE INDEX IF NOT EXISTS idx_sec_event_created  ON security_event(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_event_critical ON security_event(event_type)
  WHERE event_type IN ('prompt_injection','api_abuse','login_suspicious');

-- ─── User Sessions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_session (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL,
  user_role     VARCHAR(30)  NOT NULL REFERENCES ref_admin_role(code),
  ip_address    INET,
  device_info   TEXT,
  user_agent    TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  mfa_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_user      ON user_session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tenant    ON user_session(tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_active    ON user_session(is_active) WHERE is_active = TRUE;

-- ─── Views ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_role_permission_matrix AS
SELECT
  rp.tenant_id,
  rp.role,
  rp.resource,
  rp.is_active,
  ARRAY_AGG(rpa.action ORDER BY rpa.action) AS actions
FROM role_permission rp
LEFT JOIN role_permission_action rpa ON rpa.permission_id = rp.id
GROUP BY rp.tenant_id, rp.role, rp.resource, rp.is_active;

CREATE OR REPLACE VIEW v_security_summary AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE event_type = 'login_failed'    AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
  COUNT(*) FILTER (WHERE event_type = 'login_suspicious' AND created_at > NOW() - INTERVAL '24 hours') AS suspicious_logins_24h,
  COUNT(*) FILTER (WHERE event_type = 'prompt_injection' AND created_at > NOW() - INTERVAL '7 days')   AS injection_attempts_7d,
  COUNT(*) FILTER (WHERE resolved = FALSE) AS open_incidents
FROM security_event
GROUP BY tenant_id;
