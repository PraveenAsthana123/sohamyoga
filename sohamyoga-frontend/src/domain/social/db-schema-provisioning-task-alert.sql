-- Closes a real gap from the brutal audit: 172 real provisioning_human_task
-- rows were created with no owner, no due date, and nothing that would ever
-- alert anyone they exist. Mirrors the established ad_campaign_health_finding
-- open/resolved lifecycle pattern rather than inventing a new one.
CREATE TABLE IF NOT EXISTS provisioning_task_alert (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES provisioning_human_task(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  summary      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  UNIQUE (task_id)
);
CREATE INDEX IF NOT EXISTS idx_provisioning_task_alert_open ON provisioning_task_alert(status) WHERE status = 'open';
