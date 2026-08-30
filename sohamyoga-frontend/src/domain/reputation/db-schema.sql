-- Google Business Review Management — real integration with Google Business
-- Profile (reviews) via OAuth2, reusing the exact vault-backed credential
-- pattern already proven for the AI-ingestion module's Google connectors
-- (GoogleOAuthConnector.ts). Separate domain from `ingestion` deliberately:
-- this is reputation management (sync + reply to public Google reviews), not
-- pulling content into an AI knowledge base -- different business purpose,
-- kept out of the connector/connector_credential ingestion registry to avoid
-- conflating the two. Credential-gated like every other Google connector in
-- this repo (0 real connections exist yet) -- fails closed until the admin
-- connects a real Google Business Profile account.

CREATE TYPE google_business_auth_status AS ENUM (
  'not_configured', 'auth_requested', 'active', 'token_expired', 'auth_revoked', 'refresh_failed'
);

CREATE TABLE google_business_connection (
  id                       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID  NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  business_account_id      TEXT,
  business_location_id     TEXT,
  location_display_name    TEXT,
  auth_status              google_business_auth_status NOT NULL DEFAULT 'not_configured',
  client_id_reference      TEXT CHECK (client_id_reference IS NULL OR client_id_reference LIKE 'vault://%'),
  access_token_reference   TEXT CHECK (access_token_reference IS NULL OR access_token_reference LIKE 'vault://%'),
  refresh_token_reference  TEXT CHECK (refresh_token_reference IS NULL OR refresh_token_reference LIKE 'vault://%'),
  granted_scopes           TEXT[] NOT NULL DEFAULT '{}',
  token_expires_at         TIMESTAMPTZ,
  last_synced_at           TIMESTAMPTZ,
  last_failure_at          TIMESTAMPTZ,
  last_failure_message     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE business_review (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id     UUID NOT NULL REFERENCES google_business_connection(id) ON DELETE CASCADE,
  google_review_id  TEXT NOT NULL,
  reviewer_name     TEXT NOT NULL DEFAULT 'Anonymous',
  star_rating       SMALLINT CHECK (star_rating BETWEEN 1 AND 5),
  comment           TEXT,
  review_created_at TIMESTAMPTZ,
  reply_text        TEXT,
  reply_updated_at  TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, google_review_id)
);

CREATE INDEX idx_business_review_connection ON business_review(connection_id, review_created_at DESC);
