-- Campaign config/health auditing. Deliberately NOT spend/targeting
-- optimization: no ad platform is connected, so impression_count/click_count/
-- spend_cents on advertisement and every row of ad_analytics are structurally
-- real but always empty (nothing has ever written to them). A real
-- performance-driven optimizer would force Ollama to invent the numbers it's
-- supposedly optimizing against. Instead this audits deterministic, always-
-- knowable structural facts (no ad groups, no targeting, budget smaller than
-- a group's own bid, expired-but-still-active, etc.) computed in SQL — Ollama
-- only writes the human-readable explanation of facts it's explicitly given,
-- never a metric it wasn't handed.

CREATE TYPE campaign_health_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE campaign_health_status   AS ENUM ('open', 'acknowledged', 'resolved');

CREATE TABLE IF NOT EXISTS ad_campaign_health_finding (
  id                  UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID                      NOT NULL REFERENCES ad_campaign (id) ON DELETE CASCADE,
  finding_key         TEXT                      NOT NULL,
  severity            campaign_health_severity  NOT NULL,
  summary             TEXT                      NOT NULL,
  recommended_action  TEXT                      NOT NULL,
  facts               JSONB                     NOT NULL DEFAULT '{}',
  status              campaign_health_status    NOT NULL DEFAULT 'open',
  created_at          TIMESTAMPTZ               NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,

  CONSTRAINT health_resolved_has_date CHECK (status <> 'resolved' OR resolved_at IS NOT NULL)
);

-- At most one OPEN finding per (campaign, finding_key) — reruns of the audit
-- job must not spam duplicate findings for the same still-unresolved issue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_open_unique
  ON ad_campaign_health_finding (campaign_id, finding_key) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_health_campaign ON ad_campaign_health_finding (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_status   ON ad_campaign_health_finding (status);
