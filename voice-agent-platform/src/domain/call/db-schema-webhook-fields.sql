-- Fields populated ONLY by the real Vapi webhook receiver
-- (/api/webhooks/vapi) once a call actually ends. Until that webhook fires,
-- these stay NULL -- never fabricated/estimated.
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 4);
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS ended_reason TEXT;
