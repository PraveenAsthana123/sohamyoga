-- Voice AI Growth Engine, added 2026-09-14 -- backlog item #12. No real
-- telephony/Voice AI provider integration exists in this codebase
-- (confirmed absent -- no Twilio/SIP/IVR/voice-agent-platform wiring
-- inside sohamyoga-frontend itself; a separate voice-agent-platform app
-- exists elsewhere in this workspace but is a distinct project, not
-- audited or reused here). Real, admin-entered call transcript logging
-- only -- same honest pattern as the TalentsHill voice_call_logs table
-- built earlier this session.

CREATE TABLE IF NOT EXISTS voice_call_log (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL,
  direction          VARCHAR(10)   NOT NULL CHECK (direction IN ('inbound','outbound')),
  phone_number       VARCHAR(30),
  transcript         TEXT          NOT NULL, -- real, admin-entered -- what was actually said
  duration_seconds   INTEGER,
  call_date          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  qualification_score SMALLINT,
  qualification_tier VARCHAR(10)   CHECK (qualification_tier IN ('cold','warm','hot')),
  created_by         TEXT          NOT NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_call_log_tenant ON voice_call_log (tenant_id, call_date DESC);
