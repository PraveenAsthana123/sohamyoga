-- Social Media Portal — Database Schema
-- Tracks connected accounts, content drafts, per-platform posts, campaigns, analytics,
-- the manual-publishing queue (Quora), and the MCP approval log.
-- All tables carry tenant_id for multi-tenancy.

-- ─────────────────────────────────────────────
-- Reference / enumeration tables
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_social_platform (
  platform     TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  connector    TEXT NOT NULL CHECK (connector IN ('postiz','custom_connector','manual_only')),
  max_characters INTEGER,
  supports_scheduling BOOLEAN NOT NULL DEFAULT TRUE,
  notes        TEXT
);

INSERT INTO ref_social_platform (platform, display_name, connector, max_characters, supports_scheduling, notes) VALUES
  ('facebook',          'Facebook Pages',             'postiz',           63206, TRUE,  'Requires Facebook Page (not personal profile)'),
  ('instagram',         'Instagram Business',         'postiz',           2200,  TRUE,  'Business or Creator account required'),
  ('linkedin',          'LinkedIn',                   'postiz',           3000,  TRUE,  'Profile and Company Page supported'),
  ('x_twitter',         'X / Twitter',                'postiz',           280,   TRUE,  'API v2; paid tier required for write access'),
  ('threads',           'Threads',                    'postiz',           500,   TRUE,  'Meta Threads API'),
  ('tiktok',            'TikTok',                     'postiz',           2200,  TRUE,  'Requires TikTok for Developers app approval'),
  ('youtube',           'YouTube',                    'postiz',           5000,  TRUE,  'Video uploads and Shorts'),
  ('reddit',            'Reddit',                     'postiz',           40000, TRUE,  'Subreddit posting; requires mod/contributor status'),
  ('pinterest',         'Pinterest',                  'postiz',           500,   TRUE,  'Pins on boards'),
  ('bluesky',           'Bluesky (AT Protocol)',       'postiz',           300,   TRUE,  'No OAuth; uses app password'),
  ('mastodon',          'Mastodon',                   'postiz',           500,   TRUE,  'Federated; requires instance URL'),
  ('discord',           'Discord',                    'postiz',           2000,  TRUE,  'Webhook or bot posting'),
  ('slack',             'Slack',                      'postiz',           40000, TRUE,  'Workspace channel posting'),
  ('telegram',          'Telegram',                   'custom_connector', 4096,  TRUE,  'Bot API; channel and group posting'),
  ('whatsapp_business', 'WhatsApp Business',           'custom_connector', 4096,  FALSE, 'Meta Business API; WABA approval required'),
  ('google_business',   'Google Business Profile',    'custom_connector', 1500,  TRUE,  'Google My Business Posts API'),
  ('quora_manual',      'Quora (Manual Only)',         'manual_only',      NULL,  FALSE, 'No automated API; AI drafts only — human posts manually')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_social_account_status (
  status TEXT PRIMARY KEY
);
INSERT INTO ref_social_account_status (status) VALUES
  ('connected'),('expired'),('revoked'),('error'),('pending_auth')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_draft_status (
  status TEXT PRIMARY KEY
);
INSERT INTO ref_draft_status (status) VALUES
  ('draft'),('review_requested'),('approved'),('rejected'),
  ('scheduled'),('publishing'),('published'),('failed'),('paused')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_post_status (
  status TEXT PRIMARY KEY
);
INSERT INTO ref_post_status (status) VALUES
  ('queued'),('publishing'),('published'),('failed'),('cancelled'),('paused')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_campaign_status (
  status TEXT PRIMARY KEY
);
INSERT INTO ref_campaign_status (status) VALUES
  ('draft'),('active'),('paused'),('completed'),('cancelled')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- Connected social accounts
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_account (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            UUID NOT NULL,
  workspace_id         UUID NOT NULL,
  platform             TEXT NOT NULL REFERENCES ref_social_platform(platform),
  account_name         TEXT NOT NULL,
  platform_account_id  TEXT NOT NULL,
  profile_url          TEXT,
  avatar_url           TEXT,
  access_token_ref     TEXT NOT NULL,   -- vault reference; never store plaintext token
  refresh_token_ref    TEXT,
  token_expires_at     TIMESTAMPTZ,
  scopes               TEXT[] NOT NULL DEFAULT '{}',
  status               TEXT NOT NULL REFERENCES ref_social_account_status(status),
  postiz_account_id    TEXT,            -- Postiz internal ID after sync
  connected_by         UUID NOT NULL,
  connected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_health_check_at TIMESTAMPTZ,
  error_message        TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform, platform_account_id)
);

CREATE INDEX idx_social_account_tenant    ON social_account (tenant_id, status);
CREATE INDEX idx_social_account_platform  ON social_account (platform, status);

-- ─────────────────────────────────────────────
-- Content drafts
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_content_draft (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL,
  workspace_id        UUID NOT NULL,
  campaign_id         UUID,
  master_text         TEXT NOT NULL DEFAULT '',
  content_type        TEXT NOT NULL CHECK (content_type IN ('text','image','video','carousel','story','reel','short')),
  master_media_urls   TEXT[] NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL REFERENCES ref_draft_status(status) DEFAULT 'draft',
  timezone            TEXT NOT NULL DEFAULT 'America/Toronto',
  default_schedule_at TIMESTAMPTZ,

  -- Approval fields
  review_requested_at TIMESTAMPTZ,
  reviewed_by         UUID,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  approval_note       TEXT,

  -- AI generation metadata
  generated_with_ai   BOOLEAN NOT NULL DEFAULT TRUE,
  ai_prompt_used      TEXT,
  ai_model            TEXT,

  tags                TEXT[] NOT NULL DEFAULT '{}',
  created_by          UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_draft_tenant   ON social_content_draft (tenant_id, status);
CREATE INDEX idx_draft_campaign ON social_content_draft (campaign_id) WHERE campaign_id IS NOT NULL;

-- Per-platform adaptation of each draft
CREATE TABLE IF NOT EXISTS social_platform_variant (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id         UUID NOT NULL REFERENCES social_content_draft(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL REFERENCES ref_social_platform(platform),
  account_id       UUID NOT NULL REFERENCES social_account(id),
  adapted_text     TEXT NOT NULL DEFAULT '',
  hashtags         TEXT[] NOT NULL DEFAULT '{}',
  media_urls       TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','scheduled','published','failed','skipped')),
  platform_post_id TEXT,
  error_message    TEXT,
  retry_count      SMALLINT NOT NULL DEFAULT 0,
  scheduled_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  UNIQUE (draft_id, platform)
);

-- ─────────────────────────────────────────────
-- Per-platform posts (individual publish units)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_post (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL,
  workspace_id      UUID NOT NULL,
  draft_id          UUID NOT NULL REFERENCES social_content_draft(id),
  campaign_id       UUID,
  platform          TEXT NOT NULL REFERENCES ref_social_platform(platform),
  account_id        UUID NOT NULL REFERENCES social_account(id),
  postiz_job_id     TEXT,
  idempotency_key   TEXT NOT NULL UNIQUE,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  published_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  status            TEXT NOT NULL REFERENCES ref_post_status(status) DEFAULT 'queued',
  retry_count       SMALLINT NOT NULL DEFAULT 0 CHECK (retry_count <= 3),
  last_retry_at     TIMESTAMPTZ,
  external_post_id  TEXT,
  external_post_url TEXT,
  failure_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_tenant    ON social_post (tenant_id, status, scheduled_at);
CREATE INDEX idx_post_draft     ON social_post (draft_id);
CREATE INDEX idx_post_due       ON social_post (scheduled_at)
  WHERE status = 'queued';

-- ─────────────────────────────────────────────
-- Campaigns
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_campaign (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  workspace_id  UUID NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  goal          TEXT NOT NULL CHECK (goal IN ('brand_awareness','engagement','follower_growth','website_traffic','lead_generation','event_promotion','product_launch')),
  status        TEXT NOT NULL REFERENCES ref_campaign_status(status) DEFAULT 'draft',
  platforms     TEXT[] NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  budget        NUMERIC(12,2),
  pause_reason  TEXT,
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_tenant ON social_campaign (tenant_id, status);

-- ─────────────────────────────────────────────
-- Analytics (post-level metrics)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_post_analytics (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID NOT NULL REFERENCES social_post(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  impressions     BIGINT NOT NULL DEFAULT 0,
  reach           BIGINT NOT NULL DEFAULT 0,
  clicks          BIGINT NOT NULL DEFAULT 0,
  likes           BIGINT NOT NULL DEFAULT 0,
  comments        BIGINT NOT NULL DEFAULT 0,
  shares          BIGINT NOT NULL DEFAULT 0,
  saves           BIGINT NOT NULL DEFAULT 0,
  conversions     BIGINT NOT NULL DEFAULT 0,
  follower_delta  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_analytics_post ON social_post_analytics (post_id, fetched_at DESC);

-- ─────────────────────────────────────────────
-- Manual-publishing queue (Quora and similar)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_manual_queue (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  draft_id        UUID NOT NULL REFERENCES social_content_draft(id),
  platform        TEXT NOT NULL DEFAULT 'quora_manual',
  ai_drafted_text TEXT NOT NULL,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'awaiting_human'
                  CHECK (status IN ('awaiting_human','published_manually','discarded')),
  published_at    TIMESTAMPTZ,
  published_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- MCP approval log (social portal specific)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_mcp_approval_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  tool_name       TEXT NOT NULL,
  draft_id        UUID REFERENCES social_content_draft(id),
  campaign_id     UUID REFERENCES social_campaign(id),
  requested_by    UUID NOT NULL,
  approved_by     UUID,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','expired')),
  approval_token  TEXT UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '4 hours'),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Views
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_social_account_health AS
SELECT
  sa.tenant_id,
  sa.workspace_id,
  sa.platform,
  rp.display_name,
  rp.connector,
  sa.account_name,
  sa.status,
  sa.token_expires_at,
  CASE
    WHEN sa.status = 'connected' AND (sa.token_expires_at IS NULL OR sa.token_expires_at > now() + INTERVAL '24 hours') THEN 'healthy'
    WHEN sa.status = 'connected' AND sa.token_expires_at <= now() + INTERVAL '24 hours' THEN 'expiring_soon'
    ELSE 'action_required'
  END AS health_status,
  sa.last_health_check_at
FROM social_account sa
JOIN ref_social_platform rp ON rp.platform = sa.platform;

CREATE OR REPLACE VIEW v_post_publish_queue AS
SELECT
  sp.id,
  sp.tenant_id,
  sp.platform,
  sp.account_id,
  sp.draft_id,
  sp.scheduled_at,
  sp.retry_count,
  sp.idempotency_key,
  scd.master_text,
  scd.status AS draft_status,
  sa.account_name,
  sa.postiz_account_id
FROM social_post sp
JOIN social_content_draft scd ON scd.id = sp.draft_id
JOIN social_account sa ON sa.id = sp.account_id
WHERE sp.status = 'queued'
  AND sp.scheduled_at <= now() + INTERVAL '15 minutes'
ORDER BY sp.scheduled_at;

CREATE OR REPLACE VIEW v_campaign_performance AS
SELECT
  sc.id            AS campaign_id,
  sc.tenant_id,
  sc.name,
  sc.goal,
  sc.status,
  sc.starts_at,
  sc.ends_at,
  COUNT(sp.id)                                           AS total_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'published')   AS published_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'failed')      AS failed_posts,
  COUNT(sp.id) FILTER (WHERE sp.status = 'queued')      AS queued_posts,
  COALESCE(SUM(spa.impressions), 0)                      AS total_impressions,
  COALESCE(SUM(spa.reach), 0)                            AS total_reach,
  COALESCE(SUM(spa.clicks), 0)                           AS total_clicks,
  COALESCE(SUM(spa.likes + spa.comments + spa.shares), 0) AS total_engagements
FROM social_campaign sc
LEFT JOIN social_content_draft scd ON scd.campaign_id = sc.id
LEFT JOIN social_post sp ON sp.draft_id = scd.id
LEFT JOIN social_post_analytics spa ON spa.post_id = sp.id
GROUP BY sc.id, sc.tenant_id, sc.name, sc.goal, sc.status, sc.starts_at, sc.ends_at;
