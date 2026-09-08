-- Records EVERY real HTTP call this app makes to api.vapi.ai, not just
-- assistant-sync attempts (vapi_sync_log covers only those). This is the
-- audit trail for the tenant-isolation guard in VapiClient.ts -- if a call
-- is ever blocked for targeting an assistant this app doesn't own, that
-- block is recorded here too, not silently swallowed.
CREATE TABLE vapi_api_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method         TEXT NOT NULL,
  path           TEXT NOT NULL,
  assistant_id   TEXT,
  blocked        BOOLEAN NOT NULL DEFAULT FALSE,
  success        BOOLEAN,
  status_code    INTEGER,
  error_message  TEXT,
  duration_ms    INTEGER NOT NULL CHECK (duration_ms >= 0),
  initiated_by   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vapi_api_audit_log_created_at ON vapi_api_audit_log(created_at DESC);
CREATE INDEX idx_vapi_api_audit_log_blocked ON vapi_api_audit_log(blocked) WHERE blocked = TRUE;
