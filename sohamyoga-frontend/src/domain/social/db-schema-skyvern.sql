-- Skyvern is an execution worker, not the source of workflow truth. Every run
-- remains attached to a provisioning job and stores identifiers/status only.
CREATE TABLE IF NOT EXISTS provisioning_browser_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES account_provisioning_job(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'skyvern' CHECK (provider IN ('skyvern','playwright')),
  external_run_id TEXT NOT NULL UNIQUE,
  external_browser_session_id TEXT,
  start_url TEXT NOT NULL,
  status TEXT NOT NULL,
  app_url TEXT,
  failure_reason TEXT,
  started_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_provisioning_browser_run_job ON provisioning_browser_run(job_id,started_at DESC);

