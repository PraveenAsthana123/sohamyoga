-- Business <-> Technical Correlation -- the missing historical layer.
-- Every existing "health" check in this codebase (BrandHealthScore,
-- ResearchHealthScore, /api/health, AdminMonitoringController) is computed
-- live, on request, with nothing persisted -- so no correlation over time
-- was ever possible. This table stores a timestamped snapshot of both
-- sides so a real correlation can be computed from real history, not
-- fabricated from a single point-in-time read.
CREATE TABLE IF NOT EXISTS health_snapshot (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  captured_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- business side
  revenue_last_24h      NUMERIC(12,2) NOT NULL DEFAULT 0,
  new_leads_last_24h    INTEGER       NOT NULL DEFAULT 0,
  bookings_last_24h     INTEGER       NOT NULL DEFAULT 0,
  -- technical side
  db_reachable          BOOLEAN       NOT NULL,
  db_query_ms           INTEGER
);
CREATE INDEX IF NOT EXISTS idx_health_snapshot_tenant_time ON health_snapshot (tenant_id, captured_at DESC);
