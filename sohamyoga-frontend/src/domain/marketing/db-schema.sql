-- ─────────────────────────────────────────────────────────────────────────────
-- Digital Marketing Command Centre — Database Schema
-- All data stays in local Postgres.
-- External publishing APIs receive only: rendered content + recipient address + OAuth token.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Reference tables ─────────────────────────────────────────────────────────

CREATE TABLE ref_campaign_objective (
  code  VARCHAR(30)  PRIMARY KEY,
  label VARCHAR(60)  NOT NULL
);
INSERT INTO ref_campaign_objective VALUES
  ('awareness',     'Brand Awareness'),
  ('lead',          'Lead Generation'),
  ('registration',  'Class/Program Registration'),
  ('booking',       'Direct Booking'),
  ('sale',          'Product/Membership Sale'),
  ('retention',     'Member Retention');

CREATE TABLE ref_marketing_campaign_status (
  code  VARCHAR(20)  PRIMARY KEY,
  label VARCHAR(40)  NOT NULL
);
INSERT INTO ref_marketing_campaign_status VALUES
  ('draft',     'Draft'),
  ('approved',  'Approved'),
  ('active',    'Active / Live'),
  ('paused',    'Paused'),
  ('completed', 'Completed'),
  ('archived',  'Archived');

CREATE TABLE ref_content_platform (
  code             VARCHAR(30)  PRIMARY KEY,
  label            VARCHAR(60)  NOT NULL,
  max_chars        INTEGER      NOT NULL,   -- -1 = unlimited
  max_hashtags     INTEGER      NOT NULL,
  tone_hint        VARCHAR(60)  NOT NULL,
  supports_media   BOOLEAN      NOT NULL DEFAULT TRUE
);
INSERT INTO ref_content_platform VALUES
  ('facebook',          'Facebook',            63206, 5,  'conversational',          TRUE),
  ('instagram',         'Instagram',           2200,  30, 'visual-caption',          TRUE),
  ('linkedin',          'LinkedIn',            3000,  5,  'professional-insight',    TRUE),
  ('x_twitter',         'X / Twitter',         280,   2,  'concise-punchy',          TRUE),
  ('threads',           'Threads',             500,   5,  'conversational',          TRUE),
  ('tiktok',            'TikTok',              2200,  10, 'trending-hook',           TRUE),
  ('youtube',           'YouTube',             5000,  15, 'descriptive-chapters',    TRUE),
  ('pinterest',         'Pinterest',           500,   20, 'search-optimized',        TRUE),
  ('reddit',            'Reddit',              40000, 0,  'community-authentic',     TRUE),
  ('bluesky',           'Bluesky',             300,   2,  'concise-authentic',       TRUE),
  ('mastodon',          'Mastodon',            500,   5,  'conversational',          TRUE),
  ('telegram',          'Telegram',            4096,  5,  'announcement-buttons',    TRUE),
  ('discord',           'Discord',             2000,  0,  'community-casual',        TRUE),
  ('whatsapp_business', 'WhatsApp Business',   1024,  0,  'direct-personal',         TRUE),
  ('email',             'Email',               -1,    0,  'formal-structured',       TRUE),
  ('sms',               'SMS',                 160,   0,  'ultra-concise-direct',    FALSE),
  ('push',              'Push Notification',   100,   0,  'alert-action',            FALSE),
  ('banner',            'Banner / Display',    120,   0,  'headline-cta',            TRUE),
  ('blog',              'Blog Post',           -1,    10, 'long-form-educational',   TRUE);

CREATE TABLE ref_content_variant_status (
  code  VARCHAR(20)  PRIMARY KEY,
  label VARCHAR(40)  NOT NULL
);
INSERT INTO ref_content_variant_status VALUES
  ('draft',     'Draft'),
  ('approved',  'Approved — ready to publish'),
  ('published', 'Published');

CREATE TABLE ref_calendar_entry_status (
  code  VARCHAR(20)  PRIMARY KEY,
  label VARCHAR(40)  NOT NULL
);
INSERT INTO ref_calendar_entry_status VALUES
  ('planned',        'Planned'),
  ('in_production',  'In Production'),
  ('ready',          'Ready to Schedule'),
  ('scheduled',      'Scheduled'),
  ('published',      'Published'),
  ('cancelled',      'Cancelled');

-- ── Brand Kit ─────────────────────────────────────────────────────────────────

CREATE TABLE brand_kit (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  name             VARCHAR(120) NOT NULL,
  primary_color    VARCHAR(7)   NOT NULL,   -- #RRGGBB
  secondary_color  VARCHAR(7)   NOT NULL,
  accent_color     VARCHAR(7)   NOT NULL,
  logo_url         TEXT         NOT NULL,
  dark_logo_url    TEXT,
  font_primary     VARCHAR(80)  NOT NULL,
  font_secondary   VARCHAR(80),
  tone_words       TEXT[]       NOT NULL,   -- max 5
  approved_phrases TEXT[]       NOT NULL DEFAULT '{}',
  banned_phrases   TEXT[]       NOT NULL DEFAULT '{}',
  default_hashtags TEXT[]       NOT NULL DEFAULT '{}',
  is_default       BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_by       VARCHAR(120) NOT NULL,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_brand_kit_default ON brand_kit (tenant_id) WHERE is_default = TRUE;

-- ── Campaign Brief ────────────────────────────────────────────────────────────

CREATE TABLE campaign_brief (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL,
  name                 VARCHAR(160) NOT NULL,
  description          TEXT,
  objective            VARCHAR(30)  NOT NULL REFERENCES ref_campaign_objective(code),
  offer_type           VARCHAR(30)  NOT NULL,
  target_persona       TEXT[]       NOT NULL DEFAULT '{}',
  channels             TEXT[]       NOT NULL,
  content_sequence     TEXT[]       NOT NULL DEFAULT '{}',
  budget_planned_cad   NUMERIC(10,2) NOT NULL DEFAULT 0,
  budget_actual_cad    NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_date           DATE         NOT NULL,
  end_date             DATE         NOT NULL,
  status               VARCHAR(20)  NOT NULL DEFAULT 'draft' REFERENCES ref_marketing_campaign_status(code),
  approved_by          VARCHAR(120),
  approved_at          TIMESTAMPTZ,
  paused_reason        TEXT,
  utm_campaign         VARCHAR(120) NOT NULL,  -- slug format
  brand_kit_id         UUID         REFERENCES brand_kit(id),
  created_by           VARCHAR(120) NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_dates   CHECK (end_date > start_date),
  CONSTRAINT chk_budget  CHECK (budget_planned_cad >= 0 AND budget_actual_cad >= 0)
);
CREATE INDEX idx_campaign_brief_tenant      ON campaign_brief (tenant_id);
CREATE INDEX idx_campaign_brief_status      ON campaign_brief (status);
CREATE INDEX idx_campaign_brief_start_date  ON campaign_brief (start_date);

-- ── Content Variant ───────────────────────────────────────────────────────────

CREATE TABLE content_variant (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL,
  brief_id           UUID         REFERENCES campaign_brief(id) ON DELETE CASCADE,
  platform           VARCHAR(30)  NOT NULL REFERENCES ref_content_platform(code),
  master_content     TEXT         NOT NULL,
  adapted_content    TEXT         NOT NULL,
  adapted_subject    VARCHAR(300),                -- email subject line
  hashtags           TEXT[]       NOT NULL DEFAULT '{}',
  media_aspect_ratio VARCHAR(20),
  is_ai_generated    BOOLEAN      NOT NULL DEFAULT FALSE,
  ai_model_used      VARCHAR(80),                -- e.g. 'llama3.2:3b' (local only)
  status             VARCHAR(20)  NOT NULL DEFAULT 'draft' REFERENCES ref_content_variant_status(code),
  approved_by        VARCHAR(120),
  approved_at        TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_content_variant_brief    ON content_variant (brief_id);
CREATE INDEX idx_content_variant_platform ON content_variant (platform);
CREATE INDEX idx_content_variant_status   ON content_variant (status);

-- ── Content Calendar ──────────────────────────────────────────────────────────

CREATE TABLE content_calendar_entry (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL,
  title              VARCHAR(200) NOT NULL,
  content_type       VARCHAR(40)  NOT NULL,  -- social_post, email, sms, blog, banner, event, workshop, retreat
  channel            VARCHAR(30),
  scheduled_at       TIMESTAMPTZ  NOT NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'planned' REFERENCES ref_calendar_entry_status(code),
  brief_id           UUID         REFERENCES campaign_brief(id) ON DELETE SET NULL,
  content_variant_id UUID         REFERENCES content_variant(id) ON DELETE SET NULL,
  assigned_to        VARCHAR(120),
  tags               TEXT[]       NOT NULL DEFAULT '{}',
  notes              TEXT,
  created_by         VARCHAR(120) NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calendar_tenant       ON content_calendar_entry (tenant_id);
CREATE INDEX idx_calendar_scheduled_at ON content_calendar_entry (scheduled_at);
CREATE INDEX idx_calendar_status       ON content_calendar_entry (status);
CREATE INDEX idx_calendar_brief        ON content_calendar_entry (brief_id);

-- ── UTM Link Tracker ──────────────────────────────────────────────────────────

CREATE TABLE utm_link (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  brief_id        UUID         REFERENCES campaign_brief(id) ON DELETE CASCADE,
  base_url        TEXT         NOT NULL,
  utm_source      VARCHAR(80)  NOT NULL,
  utm_medium      VARCHAR(80)  NOT NULL,
  utm_campaign    VARCHAR(120) NOT NULL,
  utm_content     VARCHAR(120),
  utm_term        VARCHAR(120),
  full_url        TEXT         NOT NULL,   -- base_url + all params
  click_count     INTEGER      NOT NULL DEFAULT 0,
  created_by      VARCHAR(120) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_utm_link_brief    ON utm_link (brief_id);
CREATE INDEX idx_utm_link_campaign ON utm_link (utm_campaign);

-- ── Campaign Lead (attribution) ───────────────────────────────────────────────

CREATE TABLE campaign_lead (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  brief_id         UUID         REFERENCES campaign_brief(id) ON DELETE SET NULL,
  utm_link_id      UUID         REFERENCES utm_link(id) ON DELETE SET NULL,
  first_name       VARCHAR(80),
  last_name        VARCHAR(80),
  email            VARCHAR(200),
  phone            VARCHAR(30),
  source_platform  VARCHAR(40),   -- facebook_lead, linkedin_lead, website_form, ...
  funnel_stage     VARCHAR(40)    NOT NULL DEFAULT 'new',
  converted_at     TIMESTAMPTZ,
  customer_id      UUID,          -- link to customer table after conversion
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  -- PII note: email/phone stored encrypted at rest (app-layer AES-256)
  -- Never exported to external AI; suppression checked before any outreach
);
CREATE INDEX idx_campaign_lead_brief    ON campaign_lead (brief_id);
CREATE INDEX idx_campaign_lead_email    ON campaign_lead (email);
CREATE INDEX idx_campaign_lead_stage    ON campaign_lead (funnel_stage);

-- ── Campaign Analytics (daily aggregation) ────────────────────────────────────

CREATE TABLE campaign_analytics (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL,
  brief_id             UUID         NOT NULL REFERENCES campaign_brief(id) ON DELETE CASCADE,
  analytics_date       DATE         NOT NULL,
  platform             VARCHAR(30)  NOT NULL,
  impressions          INTEGER      NOT NULL DEFAULT 0,
  clicks               INTEGER      NOT NULL DEFAULT 0,
  leads_captured       INTEGER      NOT NULL DEFAULT 0,
  registrations        INTEGER      NOT NULL DEFAULT 0,
  bookings             INTEGER      NOT NULL DEFAULT 0,
  revenue_cad          NUMERIC(10,2) NOT NULL DEFAULT 0,
  spend_cad            NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (brief_id, analytics_date, platform)
);
CREATE INDEX idx_campaign_analytics_brief ON campaign_analytics (brief_id);
CREATE INDEX idx_campaign_analytics_date  ON campaign_analytics (analytics_date);

-- ── Content variant version history ──────────────────────────────────────────

CREATE TABLE content_variant_history (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_variant_id   UUID         NOT NULL REFERENCES content_variant(id) ON DELETE CASCADE,
  version              INTEGER      NOT NULL,
  adapted_content      TEXT         NOT NULL,
  adapted_subject      VARCHAR(300),
  changed_by           VARCHAR(120) NOT NULL,
  changed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cvh_variant ON content_variant_history (content_variant_id);

-- ── Views ─────────────────────────────────────────────────────────────────────

-- Campaign overview with budget utilization and content readiness
CREATE VIEW v_campaign_overview AS
SELECT
  cb.id,
  cb.tenant_id,
  cb.name,
  cb.objective,
  cb.status,
  cb.start_date,
  cb.end_date,
  cb.budget_planned_cad,
  cb.budget_actual_cad,
  CASE WHEN cb.budget_planned_cad = 0 THEN 0
       ELSE ROUND((cb.budget_actual_cad / cb.budget_planned_cad) * 100, 1)
  END AS budget_utilization_pct,
  COUNT(cv.id)                                             AS total_variants,
  COUNT(cv.id) FILTER (WHERE cv.status = 'published')      AS published_variants,
  COUNT(cv.id) FILTER (WHERE cv.status = 'approved')       AS approved_variants,
  COUNT(cv.id) FILTER (WHERE cv.status = 'draft')          AS draft_variants,
  COALESCE(SUM(ca.impressions), 0)                         AS total_impressions,
  COALESCE(SUM(ca.clicks), 0)                              AS total_clicks,
  COALESCE(SUM(ca.leads_captured), 0)                      AS total_leads,
  COALESCE(SUM(ca.bookings), 0)                            AS total_bookings,
  COALESCE(SUM(ca.revenue_cad), 0)                         AS total_revenue_cad
FROM campaign_brief cb
LEFT JOIN content_variant  cv ON cv.brief_id = cb.id
LEFT JOIN campaign_analytics ca ON ca.brief_id = cb.id
GROUP BY cb.id, cb.tenant_id, cb.name, cb.objective, cb.status,
         cb.start_date, cb.end_date, cb.budget_planned_cad, cb.budget_actual_cad;

-- Upcoming calendar (next 14 days)
CREATE VIEW v_upcoming_calendar AS
SELECT
  c.id,
  c.tenant_id,
  c.title,
  c.content_type,
  c.channel,
  c.scheduled_at,
  c.status,
  c.assigned_to,
  cb.name  AS campaign_name,
  cv.platform AS variant_platform
FROM content_calendar_entry c
LEFT JOIN campaign_brief  cb ON cb.id = c.brief_id
LEFT JOIN content_variant cv ON cv.id = c.content_variant_id
WHERE c.scheduled_at >= NOW()
  AND c.scheduled_at <  NOW() + INTERVAL '14 days'
  AND c.status NOT IN ('cancelled', 'published')
ORDER BY c.scheduled_at;

-- Platform performance summary
CREATE VIEW v_platform_performance AS
SELECT
  tenant_id,
  platform,
  SUM(impressions)   AS total_impressions,
  SUM(clicks)        AS total_clicks,
  SUM(leads_captured) AS total_leads,
  SUM(bookings)      AS total_bookings,
  SUM(revenue_cad)   AS total_revenue_cad,
  SUM(spend_cad)     AS total_spend_cad,
  CASE WHEN SUM(spend_cad) = 0 THEN NULL
       ELSE ROUND(SUM(revenue_cad) / SUM(spend_cad), 2)
  END AS roas
FROM campaign_analytics
GROUP BY tenant_id, platform;
