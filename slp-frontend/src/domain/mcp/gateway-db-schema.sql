-- MCP Gateway Database Schema
-- Tracks registered servers, per-tool allowlists, human-approval queues, and gateway audit logs.
-- Complements domain-level db-schema.sql files (identity, booking, etc.).

-- ─────────────────────────────────────────────
-- Reference / enumeration tables
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_mcp_approval_tier (
  tier        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  auto_approve BOOLEAN NOT NULL,
  sort_order  INTEGER NOT NULL
);

INSERT INTO ref_mcp_approval_tier (tier, label, auto_approve, sort_order) VALUES
  ('auto',              'Automatic',               TRUE,  1),
  ('staff',             'Staff Visible',           TRUE,  2),
  ('customer_confirm',  'Customer Confirmation',   FALSE, 3),
  ('staff_approval',    'Staff Approval',          FALSE, 4),
  ('admin',             'Admin Approval',          FALSE, 5),
  ('admin_destructive', 'Admin Destructive',       FALSE, 6)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_mcp_availability (
  availability TEXT PRIMARY KEY,
  label        TEXT NOT NULL
);

INSERT INTO ref_mcp_availability (availability, label) VALUES
  ('official',   'Official MCP Server'),
  ('community',  'Community MCP Server'),
  ('custom',     'Custom Built'),
  ('none',       'No MCP Available')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- MCP server catalog
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_gateway_server (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          UUID NOT NULL,
  slug               TEXT NOT NULL,
  name               TEXT NOT NULL,
  description        TEXT,
  version            TEXT NOT NULL DEFAULT '1.0.0',
  availability       TEXT NOT NULL REFERENCES ref_mcp_availability(availability),
  endpoint_url       TEXT,          -- null = not yet deployed
  is_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  implementation_note TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS mcp_backing_service (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id    UUID NOT NULL REFERENCES mcp_gateway_server(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- Tool catalog + allowlists
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_tool (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id     UUID NOT NULL REFERENCES mcp_gateway_server(id) ON DELETE CASCADE,
  tool_name     TEXT NOT NULL,
  description   TEXT,
  tier          TEXT NOT NULL REFERENCES ref_mcp_approval_tier(tier),
  risk_level    SMALLINT NOT NULL CHECK (risk_level BETWEEN 1 AND 5),
  input_schema  JSONB,
  safety_note   TEXT,
  tags          TEXT[],
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, tool_name)
);

CREATE TABLE IF NOT EXISTS mcp_tool_role_allowlist (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id     UUID NOT NULL REFERENCES mcp_tool(id) ON DELETE CASCADE,
  portal_role TEXT NOT NULL,          -- matches PortalRole in domain code
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tool_id, portal_role)
);

-- ─────────────────────────────────────────────
-- Human-approval queue
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_approval_request (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  tool_id         UUID NOT NULL REFERENCES mcp_tool(id),
  requested_by    UUID NOT NULL,      -- identity_account.id
  session_id      TEXT NOT NULL,
  input_payload   JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  reviewed_by     UUID,               -- identity_account.id
  reviewed_at     TIMESTAMPTZ,
  reviewer_notes  TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '4 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_approval_request_pending
  ON mcp_approval_request (tenant_id, status, expires_at)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────
-- Gateway audit log (every tool call, approved or auto)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_gateway_audit (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  tool_id         UUID NOT NULL REFERENCES mcp_tool(id),
  called_by       UUID NOT NULL,      -- identity_account.id
  session_id      TEXT NOT NULL,
  approval_request_id UUID REFERENCES mcp_approval_request(id),
  input_payload   JSONB NOT NULL,
  output_summary  TEXT,               -- brief non-PII summary; full output in Langfuse
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  duration_ms     INTEGER,
  langfuse_trace_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_gateway_audit_tool   ON mcp_gateway_audit (tool_id, created_at DESC);
CREATE INDEX idx_mcp_gateway_audit_caller ON mcp_gateway_audit (called_by, created_at DESC);
CREATE INDEX idx_mcp_gateway_audit_tenant ON mcp_gateway_audit (tenant_id, created_at DESC);

-- ─────────────────────────────────────────────
-- Views
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_mcp_tool_catalog AS
SELECT
  ms.tenant_id,
  ms.slug          AS server_slug,
  ms.name          AS server_name,
  ms.availability,
  ms.is_enabled    AS server_enabled,
  mt.tool_name,
  mt.tier,
  rmat.auto_approve,
  mt.risk_level,
  mt.is_enabled    AS tool_enabled,
  mt.safety_note,
  mt.tags
FROM mcp_tool mt
JOIN mcp_gateway_server ms ON ms.id = mt.server_id
JOIN ref_mcp_approval_tier rmat ON rmat.tier = mt.tier;

CREATE OR REPLACE VIEW v_mcp_approval_queue AS
SELECT
  mar.id,
  mar.tenant_id,
  ms.slug          AS server_slug,
  mt.tool_name,
  mt.tier,
  mt.risk_level,
  mar.requested_by,
  mar.input_payload,
  mar.status,
  mar.expires_at,
  mar.created_at,
  EXTRACT(EPOCH FROM (mar.expires_at - now()))::INT AS seconds_until_expiry
FROM mcp_approval_request mar
JOIN mcp_tool mt ON mt.id = mar.tool_id
JOIN mcp_gateway_server ms ON ms.id = mt.server_id
WHERE mar.status = 'pending';

CREATE OR REPLACE VIEW v_mcp_gateway_summary AS
SELECT
  ms.tenant_id,
  ms.slug          AS server_slug,
  ms.name          AS server_name,
  ms.availability,
  ms.is_enabled,
  COUNT(mt.id)     AS total_tools,
  COUNT(mt.id) FILTER (WHERE rmat.auto_approve = FALSE) AS approval_required_tools,
  COUNT(mt.id) FILTER (WHERE mt.risk_level >= 4) AS high_risk_tools,
  COUNT(mt.id) FILTER (WHERE mt.is_enabled = TRUE) AS enabled_tools
FROM mcp_gateway_server ms
LEFT JOIN mcp_tool mt ON mt.server_id = ms.id
LEFT JOIN ref_mcp_approval_tier rmat ON rmat.tier = mt.tier
GROUP BY ms.tenant_id, ms.slug, ms.name, ms.availability, ms.is_enabled;
