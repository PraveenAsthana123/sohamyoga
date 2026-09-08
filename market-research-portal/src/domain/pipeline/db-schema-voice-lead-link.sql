-- Closes the "capture a lead -> call the customer" loop, the concrete gap
-- identified from this session's ChatGPT voice-agent conversation extraction
-- (docs/chatgpt-extracts/voice-agent-outbound-inbound-calling-platform.md).
-- voice_call already existed with a free-text customer_ref and no real link
-- back to the lead record that generated it; lead and voice_call were two
-- disconnected islands. Runs after both db-schema-digital-marketing.sql
-- (voice_call) and db-schema-crm.sql (lead) so both tables already exist.
ALTER TABLE voice_call ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES lead(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_voice_call_lead ON voice_call(lead_id);
