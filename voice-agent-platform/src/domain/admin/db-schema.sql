-- =============================================================================
-- Admin auth schema — gates the admin UI/API routes with a real email+password
-- login. Passwords are hashed with Node's built-in scrypt (see
-- src/lib/auth.ts), never stored or logged in plaintext. Sessions are opaque
-- random tokens stored server-side (not JWTs) so a session can be revoked by
-- deleting its row — simplest correct approach for a single small admin team.
-- =============================================================================

CREATE TABLE admin_user (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- format: scrypt$<saltHex>$<hashHex>
  display_name  TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_session (
  token         TEXT PRIMARY KEY,       -- random 32-byte hex token, also the cookie value
  admin_user_id UUID NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_admin_session_user ON admin_session(admin_user_id);
CREATE INDEX idx_admin_session_expires ON admin_session(expires_at);
