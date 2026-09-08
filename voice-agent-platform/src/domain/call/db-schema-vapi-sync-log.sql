-- Real sync-attempt trace log -- vapi_assistant_id/vapi_synced_at on
-- call_script_version only ever show the LATEST state; this keeps every
-- attempt (success or failure) so "what happened, when, and why" is
-- answerable after the fact, not just "what is true right now."
CREATE TABLE vapi_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_version_id UUID NOT NULL REFERENCES call_script_version(id) ON DELETE CASCADE,
  action            TEXT NOT NULL CHECK (action IN ('create', 'update')),
  success           BOOLEAN NOT NULL,
  assistant_id      TEXT,
  error_message     TEXT,
  duration_ms       INTEGER NOT NULL CHECK (duration_ms >= 0),
  initiated_by      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vapi_sync_log_version ON vapi_sync_log(script_version_id, created_at DESC);
