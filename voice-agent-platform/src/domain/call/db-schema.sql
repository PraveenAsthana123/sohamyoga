-- =============================================================================
-- Call tracking schema — every real call (past or logged manually) lives
-- here regardless of how it was placed/received. Since no voice-provider
-- credentials exist yet (see VoiceProviderAdapter.ts), rows are currently
-- created exclusively via the manual "Log a call" admin form — staff
-- recording real call outcomes by hand. The `provider` column already
-- distinguishes 'manual' from a future real provider key (e.g. 'retell',
-- 'vapi', 'bolna') so no schema change is needed when one is wired up.
-- =============================================================================

CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE call_status AS ENUM ('queued', 'in_progress', 'completed', 'failed', 'no_answer');

CREATE TABLE call_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction         call_direction NOT NULL,
  contact_id        UUID REFERENCES contact(id) ON DELETE SET NULL,
  script_version_id UUID REFERENCES call_script_version(id) ON DELETE SET NULL,
  status            call_status NOT NULL DEFAULT 'queued',
  duration_seconds  INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  outcome_notes     TEXT,
  provider          TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'retell' | 'vapi' | 'bolna' | ...
  created_by        TEXT NOT NULL DEFAULT 'admin',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_call_log_contact ON call_log(contact_id);
CREATE INDEX idx_call_log_script_version ON call_log(script_version_id);
CREATE INDEX idx_call_log_status ON call_log(status);
CREATE INDEX idx_call_log_created_at ON call_log(created_at DESC);
CREATE INDEX idx_call_log_started_at ON call_log(started_at);
