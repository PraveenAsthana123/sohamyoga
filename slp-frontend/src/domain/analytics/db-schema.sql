-- Wave 13: User Tracking / Analytics Module — PostgreSQL Schema
-- Stack: PostHog (events), OpenReplay (replay), Umami (traffic), GrowthBook (A/B)
-- Tables: tracking_event, tracking_session, analytics_consent_record,
--         funnel_definition, funnel_step, heatmap_event,
--         analytics_retention, analytics_cohort, analytics_audit
-- Views: v_daily_visitors, v_funnel_summary, v_conversion_events

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE event_type AS ENUM (
  'page_view', 'click', 'form_start', 'form_submit', 'download',
  'booking_started', 'booking_completed',
  'payment_initiated', 'payment_completed',
  'subscription_started', 'error', 'scroll_depth', 'custom'
);

CREATE TYPE event_status AS ENUM ('pending', 'collected', 'masked', 'dropped');

CREATE TYPE session_status AS ENUM ('active', 'idle', 'ended');

CREATE TYPE device_type AS ENUM ('desktop', 'mobile', 'tablet', 'unknown');

CREATE TYPE traffic_source AS ENUM ('direct', 'search', 'social', 'email', 'referral', 'paid');

CREATE TYPE consent_level AS ENUM ('none', 'essential', 'analytics', 'marketing', 'all');

CREATE TYPE funnel_status AS ENUM ('draft', 'active', 'paused', 'archived');

-- ─────────────────────────────────────────────
-- 1. analytics_consent_record  (must exist before events)
-- ─────────────────────────────────────────────

CREATE TABLE analytics_consent_record (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id  TEXT         NOT NULL,
  user_id       TEXT,
  level         consent_level NOT NULL DEFAULT 'none',
  granted       BOOLEAN      NOT NULL DEFAULT FALSE,
  granted_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  ip_hash       TEXT         NOT NULL,    -- SHA-256; raw IP never stored
  user_agent    TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT consent_granted_has_date CHECK (
    NOT granted OR granted_at IS NOT NULL
  ),
  CONSTRAINT consent_revoked_after_granted CHECK (
    revoked_at IS NULL OR granted_at IS NULL OR revoked_at > granted_at
  )
);

CREATE INDEX idx_analytics_consent_anon   ON analytics_consent_record (anonymous_id);
CREATE INDEX idx_analytics_consent_user   ON analytics_consent_record (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_consent_level  ON analytics_consent_record (level) WHERE granted = TRUE;

-- ─────────────────────────────────────────────
-- 2. tracking_session
-- ─────────────────────────────────────────────

CREATE TABLE tracking_session (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id     TEXT          NOT NULL,
  user_id          TEXT,
  status           session_status NOT NULL DEFAULT 'active',
  started_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  page_count       INTEGER       NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  event_count      INTEGER       NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  device_type      device_type   NOT NULL DEFAULT 'unknown',
  browser          TEXT,
  os               TEXT,
  screen_width     INTEGER,
  screen_height    INTEGER,
  country          TEXT,
  referrer         TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  landing_url      TEXT          NOT NULL,
  exit_url         TEXT,
  scroll_depth_pct SMALLINT      CHECK (scroll_depth_pct IS NULL OR (scroll_depth_pct >= 0 AND scroll_depth_pct <= 100)),
  traffic_source   traffic_source,
  replay_available BOOLEAN       NOT NULL DEFAULT FALSE,
  consent_level    consent_level NOT NULL DEFAULT 'none',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT session_ended_after_started CHECK (
    ended_at IS NULL OR ended_at > started_at
  )
);

CREATE INDEX idx_session_anon    ON tracking_session (anonymous_id);
CREATE INDEX idx_tracking_session_user ON tracking_session (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_session_status  ON tracking_session (status);
CREATE INDEX idx_session_started ON tracking_session (started_at DESC);
CREATE INDEX idx_session_source  ON tracking_session (traffic_source);

-- ─────────────────────────────────────────────
-- 3. tracking_event
-- ─────────────────────────────────────────────

CREATE TABLE tracking_event (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID         NOT NULL REFERENCES tracking_session (id) ON DELETE CASCADE,
  anonymous_id  TEXT         NOT NULL,
  user_id       TEXT,
  event_type    event_type   NOT NULL,
  name          TEXT         NOT NULL CHECK (name <> ''),
  url           TEXT         NOT NULL CHECK (url <> ''),
  referrer      TEXT,
  properties    JSONB        NOT NULL DEFAULT '{}',
  status        event_status NOT NULL DEFAULT 'pending',
  consent_level consent_level NOT NULL DEFAULT 'none',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_session  ON tracking_event (session_id);
CREATE INDEX idx_event_type     ON tracking_event (event_type);
CREATE INDEX idx_event_anon     ON tracking_event (anonymous_id);
CREATE INDEX idx_event_user     ON tracking_event (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_event_url      ON tracking_event (url);
CREATE INDEX idx_event_created  ON tracking_event (created_at DESC);
-- Partial index for conversion analysis
CREATE INDEX idx_event_conversion ON tracking_event (event_type, created_at)
  WHERE event_type IN ('booking_completed', 'payment_completed', 'subscription_started');

-- ─────────────────────────────────────────────
-- 4. funnel_definition
-- ─────────────────────────────────────────────

CREATE TABLE funnel_definition (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT         NOT NULL CHECK (name <> ''),
  description   TEXT,
  status        funnel_status NOT NULL DEFAULT 'draft',
  window_hours  INTEGER      NOT NULL DEFAULT 24 CHECK (window_hours >= 1),
  created_by    TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_status ON funnel_definition (status);

-- ─────────────────────────────────────────────
-- 5. funnel_step
-- ─────────────────────────────────────────────

CREATE TABLE funnel_step (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id     UUID        NOT NULL REFERENCES funnel_definition (id) ON DELETE CASCADE,
  step_order    INTEGER     NOT NULL CHECK (step_order >= 1),
  name          TEXT        NOT NULL CHECK (name <> ''),
  event_type    event_type  NOT NULL,
  url_pattern   TEXT,
  properties    JSONB,

  UNIQUE (funnel_id, step_order)
);

CREATE INDEX idx_funnel_step_funnel ON funnel_step (funnel_id, step_order);

-- ─────────────────────────────────────────────
-- 6. heatmap_event
-- ─────────────────────────────────────────────

CREATE TABLE heatmap_event (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES tracking_session (id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  event_type   TEXT        NOT NULL CHECK (event_type IN ('click', 'scroll', 'move')),
  x_pct        SMALLINT    CHECK (x_pct BETWEEN 0 AND 100),
  y_pct        SMALLINT    CHECK (y_pct BETWEEN 0 AND 100),
  scroll_depth SMALLINT    CHECK (scroll_depth BETWEEN 0 AND 100),
  element      TEXT,       -- CSS selector or data-analytics-label
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heatmap_url     ON heatmap_event (url);
CREATE INDEX idx_heatmap_session ON heatmap_event (session_id);
CREATE INDEX idx_heatmap_type    ON heatmap_event (event_type);

-- ─────────────────────────────────────────────
-- 7. analytics_retention
-- ─────────────────────────────────────────────

CREATE TABLE analytics_retention (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_week    DATE        NOT NULL,      -- Monday of the cohort week
  period_week    DATE        NOT NULL,      -- Monday of the measurement week
  new_users      INTEGER     NOT NULL DEFAULT 0 CHECK (new_users >= 0),
  retained_users INTEGER     NOT NULL DEFAULT 0 CHECK (retained_users >= 0),
  retention_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN new_users = 0 THEN 0
         ELSE ROUND((retained_users::NUMERIC / new_users) * 100, 2)
    END
  ) STORED,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (cohort_week, period_week),
  CONSTRAINT retention_check CHECK (retained_users <= new_users)
);

-- ─────────────────────────────────────────────
-- 8. analytics_cohort
-- ─────────────────────────────────────────────

CREATE TABLE analytics_cohort (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_type   TEXT        NOT NULL CHECK (cohort_type IN ('new', 'returning', 'converted', 'churned')),
  date_from     DATE        NOT NULL,
  date_to       DATE        NOT NULL,
  user_count    INTEGER     NOT NULL DEFAULT 0 CHECK (user_count >= 0),
  session_count INTEGER     NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cohort_date_order CHECK (date_to >= date_from)
);

CREATE INDEX idx_cohort_type ON analytics_cohort (cohort_type, date_from);

-- ─────────────────────────────────────────────
-- 9. analytics_audit
-- ─────────────────────────────────────────────

CREATE TABLE analytics_audit (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT        NOT NULL,   -- e.g. 'data_export', 'session_replay_accessed', 'delete_user_data'
  actor        TEXT        NOT NULL,   -- staff userId
  subject      TEXT,                   -- userId or anonymousId acted upon
  legal_basis  TEXT,                   -- GDPR/PIPEDA basis for PII access
  ip_hash      TEXT,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_action  ON analytics_audit (action);
CREATE INDEX idx_analytics_audit_actor   ON analytics_audit (actor);
CREATE INDEX idx_analytics_audit_created ON analytics_audit (created_at DESC);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_daily_visitors AS
SELECT
  DATE(started_at)    AS day,
  COUNT(DISTINCT anonymous_id) AS unique_visitors,
  COUNT(*)            AS total_sessions,
  AVG(page_count)     AS avg_pages_per_session,
  AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, last_seen_at) - started_at)) / 60) AS avg_duration_minutes,
  COUNT(*) FILTER (WHERE page_count <= 1 AND status = 'ended') AS bounce_count,
  ROUND(
    COUNT(*) FILTER (WHERE page_count <= 1 AND status = 'ended')::NUMERIC
    / NULLIF(COUNT(*) FILTER (WHERE status = 'ended'), 0) * 100, 2
  ) AS bounce_rate_pct
FROM tracking_session
GROUP BY DATE(started_at);

CREATE OR REPLACE VIEW v_funnel_summary AS
SELECT
  fd.id        AS funnel_id,
  fd.name      AS funnel_name,
  fd.status,
  COUNT(fs.id) AS step_count,
  fd.window_hours,
  fd.created_at
FROM funnel_definition fd
LEFT JOIN funnel_step fs ON fs.funnel_id = fd.id
GROUP BY fd.id;

CREATE OR REPLACE VIEW v_conversion_events AS
SELECT
  DATE(created_at) AS day,
  event_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT anonymous_id) AS unique_visitors
FROM tracking_event
WHERE event_type IN ('booking_completed', 'payment_completed', 'subscription_started')
  AND status = 'collected'
GROUP BY DATE(created_at), event_type
ORDER BY day DESC, event_type;

-- ─────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['analytics_consent_record', 'funnel_definition'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
