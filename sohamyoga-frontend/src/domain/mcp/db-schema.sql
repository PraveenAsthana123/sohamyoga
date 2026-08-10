-- =============================================================================
-- MCP Observability Schema
-- Table-driven: ref_* for enum codes
-- Tenant-driven: tenant_id on every domain table
-- Run AFTER: src/domain/core/db-foundation.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS ref_mcp_server_status (
  code        VARCHAR(20) PRIMARY KEY,
  label       VARCHAR(40) NOT NULL,
  is_healthy  BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO ref_mcp_server_status (code, label, is_healthy) VALUES
  ('online',      'Online',      TRUE),
  ('offline',     'Offline',     FALSE),
  ('degraded',    'Degraded',    FALSE),
  ('maintenance', 'Maintenance', FALSE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_mcp_tier (
  code       VARCHAR(30) PRIMARY KEY,
  label      VARCHAR(60) NOT NULL,
  risk_level SMALLINT NOT NULL  -- 1=low, 2=medium, 3=high, 4=critical
);
INSERT INTO ref_mcp_tier (code, label, risk_level) VALUES
  ('auto',              'Auto',              1),
  ('staff',             'Staff',             2),
  ('customer_confirm',  'Customer Confirm',  2),
  ('staff_approval',    'Staff Approval',    3),
  ('admin',             'Admin',             3),
  ('admin_destructive', 'Admin Destructive', 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_mcp_call_status (
  code        VARCHAR(30) PRIMARY KEY,
  label       VARCHAR(40) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO ref_mcp_call_status (code, label, is_terminal) VALUES
  ('success',          'Success',          TRUE),
  ('failed',           'Failed',           TRUE),
  ('timeout',          'Timeout',          TRUE),
  ('pending_approval', 'Pending Approval', FALSE),
  ('approved',         'Approved',         FALSE),
  ('rejected',         'Rejected',         TRUE)
ON CONFLICT (code) DO NOTHING;

-- ─── MCP Servers ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_server (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(100) NOT NULL,
  version          VARCHAR(30)  NOT NULL,
  endpoint         TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'offline' REFERENCES ref_mcp_server_status(code),
  tool_count       SMALLINT     NOT NULL DEFAULT 0 CHECK (tool_count >= 0),
  description      TEXT         NOT NULL DEFAULT '',
  is_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
  last_checked_at  TIMESTAMPTZ,
  maintenance_note TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug),
  CONSTRAINT chk_maintenance_needs_note
    CHECK (status != 'maintenance' OR maintenance_note IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mcp_server_tenant  ON mcp_server(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_status  ON mcp_server(status);
CREATE INDEX IF NOT EXISTS idx_mcp_server_enabled ON mcp_server(is_enabled);

-- ─── MCP Tool Calls ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_tool_call (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  server_id                 UUID         NOT NULL REFERENCES mcp_server(id) ON DELETE CASCADE,
  tool_name                 VARCHAR(100) NOT NULL,
  tier                      VARCHAR(30)  NOT NULL REFERENCES ref_mcp_tier(code),
  status                    VARCHAR(30)  NOT NULL DEFAULT 'pending_approval' REFERENCES ref_mcp_call_status(code),
  actor_id                  UUID,
  actor_role                VARCHAR(40)  NOT NULL,
  duration_ms               INTEGER      CHECK (duration_ms IS NULL OR duration_ms >= 0),
  error_message             TEXT,
  approval_id               TEXT,
  rejection_reason          TEXT,
  flagged_for_review        BOOLEAN      NOT NULL DEFAULT FALSE,
  prompt_injection_suspected BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at               TIMESTAMPTZ,
  CONSTRAINT chk_approved_needs_id
    CHECK (status != 'approved' OR approval_id IS NOT NULL),
  CONSTRAINT chk_rejected_needs_reason
    CHECK (status != 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mcp_call_tenant    ON mcp_tool_call(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_call_server    ON mcp_tool_call(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_call_status    ON mcp_tool_call(status);
CREATE INDEX IF NOT EXISTS idx_mcp_call_tool      ON mcp_tool_call(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_call_actor     ON mcp_tool_call(actor_id);
CREATE INDEX IF NOT EXISTS idx_mcp_call_flagged   ON mcp_tool_call(flagged_for_review) WHERE flagged_for_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_mcp_call_injection ON mcp_tool_call(prompt_injection_suspected) WHERE prompt_injection_suspected = TRUE;
CREATE INDEX IF NOT EXISTS idx_mcp_call_created   ON mcp_tool_call(created_at DESC);

-- ─── Views ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_mcp_server_health AS
SELECT
  s.id,
  s.tenant_id,
  s.name,
  s.slug,
  s.version,
  s.status,
  s.tool_count,
  s.is_enabled,
  s.last_checked_at,
  COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '1 hour') AS calls_last_hour,
  COUNT(c.id) FILTER (WHERE c.status = 'failed' AND c.created_at > NOW() - INTERVAL '1 hour') AS failures_last_hour,
  COUNT(c.id) FILTER (WHERE c.flagged_for_review = TRUE AND c.resolved_at IS NULL) AS open_flags
FROM mcp_server s
LEFT JOIN mcp_tool_call c ON c.server_id = s.id
GROUP BY s.id;

CREATE OR REPLACE VIEW v_mcp_pending_approvals AS
SELECT
  c.id,
  c.tenant_id,
  s.name AS server_name,
  c.tool_name,
  c.tier,
  c.actor_id,
  c.actor_role,
  c.created_at,
  EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60 AS pending_minutes
FROM mcp_tool_call c
JOIN mcp_server s ON s.id = c.server_id
WHERE c.status = 'pending_approval'
ORDER BY c.created_at;
