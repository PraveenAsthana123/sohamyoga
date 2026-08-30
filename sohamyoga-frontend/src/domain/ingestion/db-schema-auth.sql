-- =============================================================================
-- Connector Credential Schema (Phase 2 of the AI-ingestion platform — scoped-down slice)
-- Run AFTER: src/domain/ingestion/db-schema.sql
--
-- Scope note: see src/domain/ingestion/integration-spec.md. Only the OAuth
-- credential vault + lifecycle is real here — RBAC/ABAC, purpose-based
-- access, tenant/project isolation testing, optimistic concurrency, and
-- authorization-decision auditing are deliberately deferred until a
-- write-capable connector or real multi-tenant/agent volume exists.
-- =============================================================================

CREATE TYPE ingestion_auth_status AS ENUM (
  'not_configured', 'auth_requested', 'active', 'token_expired', 'refreshing',
  'auth_revoked', 'refresh_failed', 'insufficient_scope', 'admin_approval_required', 'provider_blocked'
);

CREATE TABLE connector_credential (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  connector_id             UUID        NOT NULL REFERENCES connector(id) ON DELETE CASCADE,
  auth_status              ingestion_auth_status NOT NULL DEFAULT 'not_configured',
  client_id_reference      TEXT        CHECK (client_id_reference IS NULL OR client_id_reference LIKE 'vault://%'),
  client_secret_reference  TEXT        CHECK (client_secret_reference IS NULL OR client_secret_reference LIKE 'vault://%'),
  access_token_reference   TEXT        CHECK (access_token_reference IS NULL OR access_token_reference LIKE 'vault://%'),
  refresh_token_reference  TEXT        CHECK (refresh_token_reference IS NULL OR refresh_token_reference LIKE 'vault://%'),
  requested_scopes         TEXT[]      NOT NULL DEFAULT '{}',
  granted_scopes           TEXT[]      NOT NULL DEFAULT '{}',
  connected_by_type        TEXT        CHECK (connected_by_type IS NULL OR connected_by_type IN ('HUMAN','SYSTEM','AI','BROWSER_AGENT','API')),
  connected_by_id          TEXT,
  token_expires_at         TIMESTAMPTZ,
  last_refreshed_at        TIMESTAMPTZ,
  last_failure_at          TIMESTAMPTZ,
  last_failure_message     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_id)
);

CREATE INDEX idx_connector_credential_tenant  ON connector_credential(tenant_id);
CREATE INDEX idx_connector_credential_status  ON connector_credential(auth_status);
CREATE INDEX idx_connector_credential_expires ON connector_credential(token_expires_at) WHERE auth_status = 'active';
