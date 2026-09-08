-- Vapi assistant-config sync tracking. A call_script_version can be pushed
-- to Vapi as an assistant config; this records the resulting external
-- assistant id and when it last succeeded/failed, so the sync route can
-- decide create-vs-update and the UI can show real, honest sync state
-- (never fabricated -- vapi_synced_at is only set after a real 2xx response).
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT;
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_synced_at TIMESTAMPTZ;
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_sync_error TEXT;
