-- Customer self-service Call In / Call Out. No telephony automation exists in
-- this app (same standing gap as market-research-portal's voice_call), so
-- this is deliberately a real staff-facing request queue, not an automated
-- dialer: a small studio is genuinely staffed to act on these manually.
-- direction:
--   'call_in'  = customer will call the studio (staff should expect the call)
--   'call_out' = customer requests the studio call them back
CREATE TABLE IF NOT EXISTS call_request (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  customer_id    UUID          NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  direction      VARCHAR(16)   NOT NULL CHECK (direction IN ('call_in', 'call_out')),
  reason         TEXT          NOT NULL DEFAULT '',
  phone          VARCHAR(32)   NOT NULL,
  preferred_time TIMESTAMPTZ,
  status         VARCHAR(16)   NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'scheduled', 'completed', 'cancelled')),
  outcome_notes  TEXT,
  handled_by     UUID,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_request_customer ON call_request(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_request_open ON call_request(tenant_id, status)
  WHERE status IN ('requested', 'scheduled');
