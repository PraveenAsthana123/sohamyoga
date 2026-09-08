-- Secure credential references and evidence-backed integration tracking.
-- Raw credentials belong in OpenBao and are never stored in PostgreSQL.
ALTER TABLE platform_setup
  ADD COLUMN IF NOT EXISTS credential_reference TEXT
    CHECK (credential_reference IS NULL OR credential_reference LIKE 'vault://%'),
  ADD COLUMN IF NOT EXISTS configured_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_connection_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_connection_test_status TEXT
    CHECK (last_connection_test_status IS NULL OR last_connection_test_status IN ('passed','failed','unsupported')),
  ADD COLUMN IF NOT EXISTS last_connection_test_detail TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- `credential_values` is a deprecated legacy column. It is intentionally
-- retained for backward-compatible, non-destructive migration, but the API
-- never selects or writes it. New credentials are stored only in OpenBao.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='platform_setup' AND column_name='credential_values'
  ) THEN
    COMMENT ON COLUMN platform_setup.credential_values IS
      'DEPRECATED: do not read or write; secrets are stored in OpenBao via credential_reference';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS platform_setup_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key TEXT NOT NULL REFERENCES platform_setup(platform_key) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'credentials_saved','connection_test_passed','connection_test_failed',
    'connection_test_unsupported','activated','deactivated'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','info')),
  detail TEXT,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_setup_event_platform_time
  ON platform_setup_event(platform_key, created_at DESC);
