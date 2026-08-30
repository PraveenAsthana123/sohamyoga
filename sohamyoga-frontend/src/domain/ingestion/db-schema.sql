-- =============================================================================
-- Source Registry Schema (Phase 1 of the AI-ingestion platform — scoped-down slice)
-- Table-driven: tenant_id on every domain table
-- Run AFTER: src/domain/core/db-foundation.sql
--
-- Scope note: this schema deliberately covers only what Phase 1 can populate
-- with real, non-fabricated data today (see src/domain/ingestion/integration-spec.md).
-- source_relationships, source_permissions_summary, expected_sources,
-- reconciliation_runs/findings, and quarantine_items are NOT included here —
-- they require either OAuth-based connectors (Phase 2, not built) or real
-- multi-connector volume to be anything but empty scaffolding.
-- =============================================================================

CREATE TYPE ingestion_connector_status AS ENUM ('not_configured', 'healthy', 'degraded', 'auth_expired', 'unavailable');
CREATE TYPE ingestion_discovery_status AS ENUM ('registered', 'discovered', 'active', 'changed', 'unavailable', 'archived');
CREATE TYPE ingestion_classification  AS ENUM ('public', 'internal', 'confidential', 'restricted', 'highly_restricted');
CREATE TYPE ingestion_run_type        AS ENUM ('manual_import', 'scheduled_scan');
CREATE TYPE ingestion_run_status      AS ENUM ('running', 'succeeded', 'failed');

-- ─── Connector ────────────────────────────────────────────────────────────────
-- One row per source family per tenant. The canonical family list is defined
-- once in TypeScript (INGESTION_SOURCE_FAMILIES, Connector.ts) and upserted
-- idempotently at read time — not duplicated as SQL seed data here.

CREATE TABLE connector (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  connector_key                 VARCHAR(60) NOT NULL,
  source_family                 VARCHAR(60) NOT NULL,
  auth_type                     VARCHAR(30) NOT NULL DEFAULT 'none',
  status                        ingestion_connector_status NOT NULL DEFAULT 'not_configured',
  can_discover                  BOOLEAN     NOT NULL DEFAULT FALSE,
  can_read                      BOOLEAN     NOT NULL DEFAULT FALSE,
  can_write                     BOOLEAN     NOT NULL DEFAULT FALSE,
  can_webhook                   BOOLEAN     NOT NULL DEFAULT FALSE,
  can_incremental_sync          BOOLEAN     NOT NULL DEFAULT FALSE,
  last_successful_discovery_at  TIMESTAMPTZ,
  last_failure_at               TIMESTAMPTZ,
  last_failure_message          TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_key)
);

CREATE INDEX idx_connector_tenant ON connector(tenant_id);
CREATE INDEX idx_connector_status ON connector(status);

-- ─── Source ───────────────────────────────────────────────────────────────────

CREATE TABLE source (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  connector_id        UUID        NOT NULL REFERENCES connector(id) ON DELETE CASCADE,
  source_type         VARCHAR(60) NOT NULL,
  external_id         TEXT        NOT NULL,
  name                TEXT        NOT NULL CHECK (name <> ''),
  parent_source_id    UUID        REFERENCES source(id) ON DELETE SET NULL,
  classification      ingestion_classification  NOT NULL DEFAULT 'internal',
  discovery_status    ingestion_discovery_status NOT NULL DEFAULT 'registered',
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_discovered_at  TIMESTAMPTZ,
  last_verified_at    TIMESTAMPTZ,
  UNIQUE (tenant_id, connector_id, external_id)
);

CREATE INDEX idx_source_tenant    ON source(tenant_id);
CREATE INDEX idx_source_connector ON source(connector_id);
CREATE INDEX idx_source_status    ON source(discovery_status);

-- ─── Source version ───────────────────────────────────────────────────────────
-- A source keeps its identity across content changes; every detected change
-- appends a version row rather than creating a new source (per Phase 1 spec's
-- explicit "do not create a completely new source every time a document changes").

CREATE TABLE source_version (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        UUID        NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  version_label    TEXT        NOT NULL,
  content_hash     TEXT,
  changed_summary  JSONB       NOT NULL DEFAULT '{}',
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_version_source ON source_version(source_id);

-- ─── Discovery run ────────────────────────────────────────────────────────────

CREATE TABLE discovery_run (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  connector_id        UUID        NOT NULL REFERENCES connector(id) ON DELETE CASCADE,
  source_id           UUID        REFERENCES source(id) ON DELETE CASCADE,
  run_type            ingestion_run_type   NOT NULL,
  status               ingestion_run_status NOT NULL DEFAULT 'running',
  sources_discovered  INTEGER     NOT NULL DEFAULT 0,
  sources_new         INTEGER     NOT NULL DEFAULT 0,
  sources_changed     INTEGER     NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  error_message       TEXT
);

CREATE INDEX idx_discovery_run_tenant    ON discovery_run(tenant_id);
CREATE INDEX idx_discovery_run_connector ON discovery_run(connector_id);
CREATE INDEX idx_discovery_run_source    ON discovery_run(source_id);
CREATE INDEX idx_discovery_run_started   ON discovery_run(started_at DESC);

-- ─── Views ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_ingestion_registry_summary AS
SELECT
  c.tenant_id,
  COUNT(DISTINCT c.id) AS connectors_total,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status <> 'not_configured') AS connectors_configured,
  COUNT(DISTINCT s.id) AS sources_total,
  COUNT(DISTINCT s.id) FILTER (WHERE s.discovery_status = 'active')  AS sources_active,
  COUNT(DISTINCT s.id) FILTER (WHERE s.discovery_status = 'changed') AS sources_changed,
  COUNT(DISTINCT s.id) FILTER (WHERE s.discovery_status = 'unavailable') AS sources_unavailable
FROM connector c
LEFT JOIN source s ON s.connector_id = c.id
GROUP BY c.tenant_id;
