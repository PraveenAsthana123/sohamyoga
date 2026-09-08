-- Tracks the real provider-assigned call id (e.g. Vapi's call.id) so a
-- later webhook can reconcile the real transcript/duration/cost back onto
-- this exact call_log row. NULL for manually-logged calls (provider =
-- 'manual'), populated the moment a real placeCall() succeeds.
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS external_call_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_log_external_id ON call_log(external_call_id) WHERE external_call_id IS NOT NULL;
