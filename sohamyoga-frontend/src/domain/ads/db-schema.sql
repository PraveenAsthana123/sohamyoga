-- Wave 15: Google Ads-like Platform — PostgreSQL Schema
-- Stack: Revive Adserver (ad serving), PostHog (analytics), GrowthBook (A/B),
--        Ollama (AI copy), ComfyUI (image gen), Listmonk (email), Activepieces (automation)
-- Tables: ad_campaign, ad_group, ad_keyword, advertisement, ad_analytics,
--         ad_audience, ad_budget_event, ad_audit
-- Views: v_campaign_summary, v_ad_performance, v_daily_roas

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE campaign_status    AS ENUM ('draft', 'active', 'paused', 'archived', 'ended');
CREATE TYPE campaign_type      AS ENUM ('search', 'display', 'video', 'shopping', 'app');
CREATE TYPE bidding_strategy   AS ENUM ('manual_cpc', 'target_cpa', 'target_roas', 'maximize_clicks', 'maximize_conversions');
CREATE TYPE ad_group_status    AS ENUM ('active', 'paused', 'removed');
CREATE TYPE keyword_match_type AS ENUM ('broad', 'phrase', 'exact');
CREATE TYPE ad_type            AS ENUM ('responsive_search', 'display', 'banner', 'video', 'image', 'dynamic', 'call');
CREATE TYPE ad_status          AS ENUM ('active', 'paused', 'removed', 'under_review');
CREATE TYPE device_target      AS ENUM ('desktop', 'mobile', 'tablet', 'tv');

-- ─────────────────────────────────────────────
-- 1. ad_campaign
-- ─────────────────────────────────────────────

CREATE TABLE ad_campaign (
  id                   UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT              NOT NULL CHECK (name <> ''),
  campaign_type        campaign_type     NOT NULL,
  status               campaign_status   NOT NULL DEFAULT 'draft',
  daily_budget_cents   INTEGER           NOT NULL CHECK (daily_budget_cents >= 1),
  total_budget_cents   INTEGER           CHECK (total_budget_cents >= daily_budget_cents),
  bidding_strategy     bidding_strategy  NOT NULL DEFAULT 'manual_cpc',
  geo_targets          TEXT[]            NOT NULL DEFAULT '{}',
  device_targets       device_target[]   NOT NULL DEFAULT '{}',
  language_targets     TEXT[]            NOT NULL DEFAULT '{}',
  audience_targets     TEXT[]            NOT NULL DEFAULT '{}',
  tags                 TEXT[]            NOT NULL DEFAULT '{}',
  start_date           DATE              NOT NULL,
  end_date             DATE,
  created_by           TEXT              NOT NULL,
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ       NOT NULL DEFAULT now(),

  CONSTRAINT camp_ended_has_date CHECK (
    status <> 'ended' OR end_date IS NOT NULL
  ),
  CONSTRAINT camp_end_after_start CHECK (
    end_date IS NULL OR end_date > start_date
  ),
  CONSTRAINT camp_total_ge_daily CHECK (
    total_budget_cents IS NULL OR total_budget_cents >= daily_budget_cents
  )
);

CREATE INDEX idx_campaign_status    ON ad_campaign (status);
CREATE INDEX idx_campaign_type      ON ad_campaign (campaign_type);
CREATE INDEX idx_campaign_created   ON ad_campaign (created_at DESC);

-- ─────────────────────────────────────────────
-- 2. ad_group
-- ─────────────────────────────────────────────

CREATE TABLE ad_group (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID            NOT NULL REFERENCES ad_campaign (id) ON DELETE CASCADE,
  name              TEXT            NOT NULL CHECK (name <> ''),
  status            ad_group_status NOT NULL DEFAULT 'active',
  default_bid_cents INTEGER         NOT NULL CHECK (default_bid_cents >= 1),
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_adgroup_campaign ON ad_group (campaign_id);
CREATE INDEX idx_adgroup_status   ON ad_group (status);

-- ─────────────────────────────────────────────
-- 3. ad_keyword
-- ─────────────────────────────────────────────

CREATE TABLE ad_keyword (
  id                     UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_group_id            UUID               NOT NULL REFERENCES ad_group (id) ON DELETE CASCADE,
  text                   TEXT               NOT NULL CHECK (text <> ''),
  match_type             keyword_match_type NOT NULL,
  bid_adjustment_percent INTEGER            CHECK (bid_adjustment_percent BETWEEN -90 AND 900),
  is_negative            BOOLEAN            NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ        NOT NULL DEFAULT now(),

  UNIQUE (ad_group_id, text, match_type)
);

CREATE INDEX idx_keyword_adgroup ON ad_keyword (ad_group_id);
CREATE INDEX idx_keyword_text    ON ad_keyword (text);

-- ─────────────────────────────────────────────
-- 4. advertisement
-- ─────────────────────────────────────────────

CREATE TABLE advertisement (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_group_id      UUID        NOT NULL REFERENCES ad_group (id) ON DELETE CASCADE,
  name             TEXT        NOT NULL CHECK (name <> ''),
  ad_type          ad_type     NOT NULL,
  status           ad_status   NOT NULL DEFAULT 'under_review',
  headlines        TEXT[]      NOT NULL DEFAULT '{}',
  descriptions     TEXT[]      NOT NULL DEFAULT '{}',
  image_urls       TEXT[]      NOT NULL DEFAULT '{}',
  video_url        TEXT,
  call_to_action   TEXT,
  final_url        TEXT        NOT NULL CHECK (final_url <> ''),
  ai_generated     BOOLEAN     NOT NULL DEFAULT FALSE,
  generated_by     TEXT,       -- 'ollama', 'comfyui'
  impression_count BIGINT      NOT NULL DEFAULT 0 CHECK (impression_count >= 0),
  click_count      BIGINT      NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  conversion_count BIGINT      NOT NULL DEFAULT 0 CHECK (conversion_count >= 0),
  spend_cents      BIGINT      NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ad_min_headline    CHECK (cardinality(headlines)    >= 1),
  CONSTRAINT ad_max_headline    CHECK (cardinality(headlines)    <= 15),
  CONSTRAINT ad_min_description CHECK (cardinality(descriptions) >= 1),
  CONSTRAINT ad_max_description CHECK (cardinality(descriptions) <= 4),
  CONSTRAINT ad_clicks_le_impressions CHECK (
    click_count = 0 OR impression_count >= click_count
  )
);

CREATE INDEX idx_ad_adgroup  ON advertisement (ad_group_id);
CREATE INDEX idx_ad_status   ON advertisement (status);
CREATE INDEX idx_ad_type     ON advertisement (ad_type);
CREATE INDEX idx_ad_ai       ON advertisement (ai_generated) WHERE ai_generated = TRUE;

-- ─────────────────────────────────────────────
-- 5. ad_analytics
-- ─────────────────────────────────────────────

CREATE TABLE ad_analytics (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID        NOT NULL REFERENCES ad_campaign (id) ON DELETE CASCADE,
  ad_group_id    UUID        REFERENCES ad_group (id),
  ad_id          UUID        REFERENCES advertisement (id),
  period_start   DATE        NOT NULL,
  period_end     DATE        NOT NULL,
  clicks         BIGINT      NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  impressions    BIGINT      NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  conversions    BIGINT      NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  spend_cents    BIGINT      NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  revenue_cents  BIGINT      NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT analytics_period_valid CHECK (period_end > period_start),
  CONSTRAINT analytics_clicks_le_impressions CHECK (
    impressions = 0 OR clicks <= impressions
  )
);

CREATE INDEX idx_analytics_campaign ON ad_analytics (campaign_id, period_start DESC);
CREATE INDEX idx_analytics_ad       ON ad_analytics (ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX idx_analytics_period   ON ad_analytics (period_start, period_end);

-- ─────────────────────────────────────────────
-- 6. ad_audience
-- ─────────────────────────────────────────────

CREATE TABLE ad_audience (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID        NOT NULL REFERENCES ad_campaign (id) ON DELETE CASCADE,
  audience_type  TEXT        NOT NULL CHECK (audience_type IN ('geo', 'device', 'language', 'interest', 'custom', 'lookalike')),
  segment_key    TEXT        NOT NULL,
  segment_value  TEXT        NOT NULL,
  bid_adjustment INTEGER     CHECK (bid_adjustment BETWEEN -90 AND 900),
  is_excluded    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audience_campaign ON ad_audience (campaign_id);
CREATE INDEX idx_audience_type     ON ad_audience (audience_type);

-- ─────────────────────────────────────────────
-- 7. ad_budget_event
-- ─────────────────────────────────────────────

CREATE TABLE ad_budget_event (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID        NOT NULL REFERENCES ad_campaign (id) ON DELETE CASCADE,
  event_type           TEXT        NOT NULL CHECK (event_type IN ('spend', 'refund', 'budget_increase', 'budget_decrease', 'daily_cap_hit')),
  amount_cents         BIGINT      NOT NULL,
  daily_budget_cents   INTEGER,
  total_budget_cents   INTEGER,
  recorded_by          TEXT        NOT NULL,  -- 'system' or userId
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_campaign ON ad_budget_event (campaign_id, created_at DESC);
CREATE INDEX idx_budget_type     ON ad_budget_event (event_type);

-- ─────────────────────────────────────────────
-- 8. ad_audit
-- ─────────────────────────────────────────────

CREATE TABLE ad_audit (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT        NOT NULL,  -- 'audience_data_accessed', 'campaign_exported', 'campaign_deleted', 'budget_overridden'
  actor        TEXT        NOT NULL,  -- staff userId
  campaign_id  UUID        REFERENCES ad_campaign (id),
  subject_id   TEXT,                  -- target entity id
  legal_basis  TEXT,                  -- GDPR/PIPEDA basis
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_audit_action  ON ad_audit (action);
CREATE INDEX idx_ad_audit_actor   ON ad_audit (actor);
CREATE INDEX idx_ad_audit_created ON ad_audit (created_at DESC);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_campaign_summary AS
SELECT
  c.id,
  c.name,
  c.campaign_type,
  c.status,
  c.daily_budget_cents,
  c.total_budget_cents,
  c.bidding_strategy,
  COUNT(DISTINCT g.id)  AS ad_group_count,
  COUNT(DISTINCT a.id)  AS ad_count,
  COALESCE(SUM(n.spend_cents), 0)  AS total_spend_cents,
  COALESCE(SUM(n.impressions), 0)  AS total_impressions,
  COALESCE(SUM(n.clicks), 0)       AS total_clicks,
  COALESCE(SUM(n.conversions), 0)  AS total_conversions
FROM ad_campaign c
LEFT JOIN ad_group g      ON g.campaign_id = c.id
LEFT JOIN advertisement a ON a.ad_group_id = g.id
LEFT JOIN ad_analytics n  ON n.campaign_id = c.id
GROUP BY c.id;

CREATE OR REPLACE VIEW v_ad_performance AS
SELECT
  a.id,
  a.name,
  a.ad_type,
  a.status,
  g.name                AS ad_group_name,
  c.name                AS campaign_name,
  a.impression_count,
  a.click_count,
  a.conversion_count,
  a.spend_cents,
  CASE WHEN a.impression_count > 0
    THEN ROUND(a.click_count::NUMERIC / a.impression_count * 100, 2)
    ELSE 0 END          AS ctr_percent,
  CASE WHEN a.click_count > 0
    THEN ROUND(a.spend_cents::NUMERIC / a.click_count, 2)
    ELSE 0 END          AS cpc_cents
FROM advertisement a
JOIN ad_group g    ON g.id = a.ad_group_id
JOIN ad_campaign c ON c.id = g.campaign_id;

CREATE OR REPLACE VIEW v_daily_roas AS
SELECT
  n.period_start          AS day,
  c.name                  AS campaign,
  c.campaign_type,
  SUM(n.spend_cents)      AS spend_cents,
  SUM(n.revenue_cents)    AS revenue_cents,
  SUM(n.clicks)           AS clicks,
  SUM(n.impressions)      AS impressions,
  CASE WHEN SUM(n.spend_cents) > 0
    THEN ROUND(SUM(n.revenue_cents)::NUMERIC / SUM(n.spend_cents), 4)
    ELSE 0 END            AS roas
FROM ad_analytics n
JOIN ad_campaign c ON c.id = n.campaign_id
GROUP BY n.period_start, c.id, c.name, c.campaign_type
ORDER BY day DESC, spend_cents DESC;

-- ─────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['ad_campaign', 'ad_group', 'advertisement'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
