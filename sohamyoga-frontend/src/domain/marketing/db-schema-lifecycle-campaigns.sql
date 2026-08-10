-- Lifecycle campaigns (audience-triggered email/WhatsApp/SMS/push messaging with
-- a conversion goal) for /admin/campaigns. Distinct from campaign_brief (paid/
-- social content campaigns) and campaign_lead (individual lead records) — this
-- is the "August Free -> Monthly Push" style recurring/drip/one-time messaging
-- concept that previously only existed as hardcoded SEED_CAMPAIGNS in the UI.

CREATE TABLE IF NOT EXISTS lifecycle_campaign (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  name            VARCHAR(160) NOT NULL,
  campaign_type   VARCHAR(20)  NOT NULL CHECK (campaign_type IN ('one_time','trigger','drip','referral')),
  channels        TEXT[]       NOT NULL DEFAULT '{}',
  status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','CANCELLED')),
  audience_label  VARCHAR(160) NOT NULL,
  audience_size   INTEGER      NOT NULL DEFAULT 0,
  goal_type       VARCHAR(40)  NOT NULL,
  goal_target     INTEGER      NOT NULL DEFAULT 0,
  conversions     INTEGER      NOT NULL DEFAULT 0,
  revenue_cad     NUMERIC(10,2) NOT NULL DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  created_by      VARCHAR(120) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_campaign_status ON lifecycle_campaign(tenant_id, status);
