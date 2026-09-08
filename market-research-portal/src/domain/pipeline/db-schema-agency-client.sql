-- Agency client self-service: a real second customer base, distinct from
-- lead (pre-conversion) and distinct from the yoga customer self-service in
-- sohamyoga-frontend. A client is a company that has signed on for one or
-- more agency services (digital marketing, branding, market research, AI
-- automation, campaign/ads management) and can log in to see its own
-- engagements and deliverables -- nothing shared across clients.
CREATE TABLE IF NOT EXISTS agency_client (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL CHECK (company_name <> ''),
  contact_name      TEXT NOT NULL CHECK (contact_name <> ''),
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL, -- scrypt: 'salt:hash' hex
  industry_vertical TEXT NOT NULL DEFAULT 'other' CHECK (industry_vertical IN ('yoga','edtech','agritech','solartech','other')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
  source_intake_submission_id UUID REFERENCES intake_submission(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_session (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES agency_client(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_session_client ON client_session(client_id);

CREATE TABLE IF NOT EXISTS client_engagement (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES agency_client(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('digital_marketing', 'branding', 'market_research', 'ai_automation', 'campaign_management', 'ads_management')),
  status       TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'completed', 'paused', 'cancelled')),
  started_at   TIMESTAMPTZ,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_engagement_client ON client_engagement(client_id, status);

CREATE TABLE IF NOT EXISTS client_deliverable (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    UUID NOT NULL REFERENCES client_engagement(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (title <> ''),
  description      TEXT NOT NULL DEFAULT '',
  deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('report', 'asset', 'campaign_summary', 'other')),
  content_url      TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'delivered')),
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_deliverable_engagement ON client_deliverable(engagement_id, status);
