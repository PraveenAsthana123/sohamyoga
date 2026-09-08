-- Closes the 3 genuinely-buildable, non-credential-blocked gaps identified
-- against docs/chatgpt-extracts/digital-marketing-flow-video-hooks.md:
-- Topic Intelligence Engine, Topic Flow Designer, Hook A/B testing.

-- Topic Intelligence Engine: signals aggregated from data this app actually
-- has (competitor entries, lead messages, hook performance) — deliberately
-- NOT external trend/social listening, since no such API/credential exists
-- here. TopicIntelligenceJob.ts recomputes this daily; a quiet day produces
-- zero rows, never a fabricated trend.
CREATE TABLE IF NOT EXISTS topic_signal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  topic           TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('competitor', 'lead_message', 'hook_performance')),
  signal_strength INT NOT NULL DEFAULT 1,
  detail          TEXT,
  captured_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, topic, source, captured_on)
);
CREATE INDEX IF NOT EXISTS idx_topic_signal_workspace ON topic_signal(workspace_id, captured_on DESC, signal_strength DESC);

-- Topic Flow Designer: hook -> context -> value -> CTA timing map, optionally
-- attached to a real content_hook.
CREATE TABLE IF NOT EXISTS topic_flow (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  hook_id       UUID REFERENCES content_hook(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS topic_flow_stage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id           UUID NOT NULL REFERENCES topic_flow(id) ON DELETE CASCADE,
  stage_type        TEXT NOT NULL CHECK (stage_type IN ('hook', 'context', 'value', 'cta')),
  sequence_order    INT NOT NULL,
  start_second      NUMERIC(6,1) NOT NULL DEFAULT 0,
  duration_seconds  NUMERIC(6,1) NOT NULL DEFAULT 0,
  script_text       TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, sequence_order)
);
CREATE INDEX IF NOT EXISTS idx_topic_flow_workspace ON topic_flow(workspace_id);

-- Hook A/B testing: pairs two real content_hook rows. The comparison itself
-- is computed live from content_factory_metric (via each hook's attached
-- variants) using a two-proportion z-test with a 30-view-per-arm floor —
-- never stored, so it can't go stale or be read as final before enough real
-- data exists.
CREATE TABLE IF NOT EXISTS hook_experiment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  hook_a_id       UUID NOT NULL REFERENCES content_hook(id) ON DELETE CASCADE,
  hook_b_id       UUID NOT NULL REFERENCES content_hook(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'concluded')),
  winner_hook_id  UUID REFERENCES content_hook(id) ON DELETE SET NULL,
  concluded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hook_a_id <> hook_b_id)
);
CREATE INDEX IF NOT EXISTS idx_hook_experiment_workspace ON hook_experiment(workspace_id, status);
