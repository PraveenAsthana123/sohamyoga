-- Advanced Vapi assistant config, controllable per script version rather
-- than hardcoded in VapiAssistantSync.ts -- model/voice/transcriber
-- selection and call-shape limits, all real Vapi Assistant API fields
-- (confirmed against the live API 2026-09-02: voice.provider/voiceId,
-- transcriber.provider/model/language, endCallMessage,
-- silenceTimeoutSeconds, maxDurationSeconds all accepted as-is).
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_model_provider TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_model TEXT NOT NULL DEFAULT 'gpt-4o';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_voice_provider TEXT NOT NULL DEFAULT '11labs';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_voice_id TEXT NOT NULL DEFAULT 'burt';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_transcriber_provider TEXT NOT NULL DEFAULT 'deepgram';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_transcriber_model TEXT NOT NULL DEFAULT 'nova-2';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_transcriber_language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_end_call_message TEXT NOT NULL DEFAULT 'Thank you, goodbye.';
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_silence_timeout_seconds INTEGER NOT NULL DEFAULT 30 CHECK (vapi_silence_timeout_seconds > 0);
ALTER TABLE call_script_version ADD COLUMN IF NOT EXISTS vapi_max_duration_seconds INTEGER NOT NULL DEFAULT 600 CHECK (vapi_max_duration_seconds > 0);
