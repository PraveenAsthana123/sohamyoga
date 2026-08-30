-- Zero-knowledge password manager schema. The server NEVER stores or sees a
-- plaintext master password, master key, or vault key -- only ciphertext and
-- KDF parameters. All encryption/decryption happens client-side (Web Crypto
-- API, AES-256-GCM + PBKDF2). A compromised database alone cannot decrypt any
-- stored credential.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_user (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       TEXT NOT NULL UNIQUE,
  kdf_salt                    TEXT NOT NULL,        -- base64, random per-user PBKDF2 salt
  kdf_iterations              INTEGER NOT NULL DEFAULT 600000,
  -- Client derives masterKey = PBKDF2(masterPassword, kdf_salt), then a
  -- second-stage hash of masterKey is sent as the login credential (never
  -- the master password or master key itself). Server re-hashes that with
  -- Argon2id before storing -- a raw DB leak alone is not a usable credential.
  auth_hash                   TEXT NOT NULL,
  -- The real vault-item encryption key ("Vault Key") is a random AES-256 key
  -- generated client-side at signup, encrypted with the user's masterKey,
  -- and stored here as ciphertext only.
  encrypted_vault_key         TEXT NOT NULL,
  encrypted_vault_key_iv      TEXT NOT NULL,
  -- Asymmetric keypair reserved for future vault sharing (wrap the Vault Key
  -- with a recipient's public key). Not used by anything yet in this phase.
  public_key                  TEXT,
  encrypted_private_key       TEXT,
  encrypted_private_key_iv    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vault_item (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  ciphertext   TEXT NOT NULL,   -- AES-256-GCM ciphertext of {label,username,password,url,notes}
  iv           TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vault_item_owner ON vault_item(owner_id);

CREATE TABLE app_session (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,  -- sha256 of the raw session token; raw token never stored
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_session_token ON app_session(token_hash);
