-- Mandatory operations tracking: every failure/blocker across this portal's
-- real tables surfaces here as an alert with an open -> acknowledged ->
-- resolved lifecycle, matching the proven pattern in sohamyoga-frontend's
-- campaign_health_audit findings and its ref_operation_status/ref_event_
-- severity reference-table convention (not inline CHECK constraints, so
-- new severities/statuses/tracked tables are data, not migrations).

CREATE TABLE IF NOT EXISTS ref_alert_severity (
  code VARCHAR(12) PRIMARY KEY,
  rank SMALLINT NOT NULL UNIQUE CHECK (rank BETWEEN 1 AND 3)
);
INSERT INTO ref_alert_severity(code,rank) VALUES
 ('info',1),('warning',2),('critical',3)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_alert_status (
  code VARCHAR(16) PRIMARY KEY,
  label VARCHAR(40) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO ref_alert_status(code,label,is_terminal) VALUES
 ('open','Open',FALSE),('acknowledged','Acknowledged',FALSE),('resolved','Resolved',TRUE)
ON CONFLICT (code) DO NOTHING;

-- The mandatory reference/catalog table: every table this portal sweeps for
-- failures is a registered row here, not a hardcoded string in application
-- code — adding a new tracked table means an INSERT here plus one sweep
-- clause, and the admin UI's table-level breakdown is driven entirely by
-- this catalog.
CREATE TABLE IF NOT EXISTS ref_tracked_operation (
  source_table   TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  enabled        BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_tracked_operation(source_table,display_name,description) VALUES
 ('marketing_production_job','Marketing Production Jobs','script/voice/video/publish job queue — failed or blocked rows'),
 ('marketing_event_log','Marketing Event Log','every operator/provider action across digital marketing — blocked/failure outcomes'),
 ('voice_call','Voice AI Calls','inbound/outbound call ledger — failed dispositions'),
 ('voice_call_event','Voice AI Call Events','per-call provider event stream — failure events'),
 ('content_factory_project','AI Content Factory Projects','video production projects stuck failed/blocked'),
 ('ollama_circuit_breaker','Local Ollama (OllamaClient)','circuit-breaker open state on the shared local-model client'),
 ('job_run','Pipeline Job Runs','17-phase pipeline job_registry executions — failed rows'),
 ('schema_migration_run','DB / Schema Migrations','scripts/migrate.ts runs — failed schema files'),
 ('api_error_log','API Route Errors','unhandled 5xx exceptions thrown inside wrapped API route handlers'),
 ('ui_error_log','UI Console Errors','uncaught browser errors/promise rejections reported by UiErrorReporter on every page'),
 ('test_run','E2E Test Runs','scripts/ingest-test-results.ts readings of the Playwright JSON reporter output — failed/timed-out specs')
ON CONFLICT (source_table) DO NOTHING;

-- API layer: routes wrapped in withApiErrorLog() (src/lib/api-error-log.ts)
-- record every unhandled exception here instead of it only reaching the
-- Next.js server log, which nobody is watching in real time.
CREATE TABLE IF NOT EXISTS api_error_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method        TEXT NOT NULL,
  path          TEXT NOT NULL,
  status        INT NOT NULL,
  error_message TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_error_log_recent ON api_error_log(occurred_at DESC);

-- UI layer: UiErrorReporter (mounted in root layout) reports every uncaught
-- window error / unhandled promise rejection here, so a broken admin page
-- is visible in this dashboard instead of only in a browser DevTools
-- console nobody but the affected user ever opens.
CREATE TABLE IF NOT EXISTS ui_error_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path    TEXT NOT NULL,
  message      TEXT NOT NULL,
  stack        TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ui_error_log_recent ON ui_error_log(occurred_at DESC);

-- Testing layer: scripts/ingest-test-results.ts reads the Playwright JSON
-- reporter output (test-results/pipeline.json) after `npm run test:e2e` and
-- writes one row per run here — a real "was the suite green" signal instead
-- of trusting a stale terminal scrollback.
CREATE TABLE IF NOT EXISTS test_run (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite        TEXT NOT NULL DEFAULT 'pipeline',
  expected     INT NOT NULL,
  unexpected   INT NOT NULL,
  flaky        INT NOT NULL DEFAULT 0,
  skipped      INT NOT NULL DEFAULT 0,
  failing_titles JSONB NOT NULL DEFAULT '[]',
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_run_recent ON test_run(ran_at DESC);

-- DB / schema layer: migrate.ts now records every run here instead of only
-- printing to stdout — a failed migration was previously invisible to
-- anything except whoever happened to be watching the terminal.
CREATE TABLE IF NOT EXISTS schema_migration_run (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name    TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('succeeded','failed')),
  error_message TEXT,
  started_at   TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schema_migration_run_status ON schema_migration_run(status, completed_at DESC);

CREATE TABLE IF NOT EXISTS operations_alert (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table  TEXT NOT NULL REFERENCES ref_tracked_operation(source_table),
  entity_id     TEXT NOT NULL,
  severity      VARCHAR(12) NOT NULL DEFAULT 'warning' REFERENCES ref_alert_severity(code),
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  status        VARCHAR(16) NOT NULL DEFAULT 'open' REFERENCES ref_alert_status(code),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at   TIMESTAMPTZ,
  UNIQUE (source_table, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_operations_alert_status ON operations_alert(status, severity, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_alert_table ON operations_alert(source_table, status);

-- Mandatory transactional history (policy §3) — every state change on every
-- alert, real timestamp, never synthesized from the mutable row itself.
CREATE TABLE IF NOT EXISTS operations_alert_event (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id    UUID NOT NULL REFERENCES operations_alert(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('found','reseen','acknowledged','resolved','reopened')),
  detail      TEXT NOT NULL DEFAULT '',
  actor       TEXT NOT NULL DEFAULT 'system',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operations_alert_event_alert ON operations_alert_event(alert_id, occurred_at DESC);
