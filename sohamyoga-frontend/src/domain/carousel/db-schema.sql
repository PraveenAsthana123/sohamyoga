-- Wave 12: Carousel / Slider Module — PostgreSQL Schema
-- Tables: carousel, carousel_slide, carousel_slide_overlay,
--         carousel_analytics, carousel_slide_analytics,
--         carousel_schedule, carousel_audit, carousel_notification
-- Views: v_carousel_summary, v_slide_performance, v_active_slides

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE carousel_location AS ENUM (
  'hero', 'testimonials', 'gallery', 'teachers', 'services',
  'promotions', 'classes', 'partners', 'videos', 'products'
);

CREATE TYPE carousel_status AS ENUM ('draft', 'active', 'paused', 'archived');

CREATE TYPE carousel_effect AS ENUM ('slide', 'fade', 'coverflow', 'cube', 'flip');

CREATE TYPE slide_type AS ENUM ('image', 'video_mp4', 'youtube', 'vimeo');

CREATE TYPE slide_status AS ENUM ('draft', 'active', 'inactive', 'scheduled');

CREATE TYPE overlay_position AS ENUM (
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right'
);

-- ─────────────────────────────────────────────
-- 1. carousel
-- ─────────────────────────────────────────────

CREATE TABLE carousel (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT          NOT NULL CHECK (name <> ''),
  location         carousel_location NOT NULL,
  status           carousel_status   NOT NULL DEFAULT 'draft',
  description      TEXT,
  view_count       BIGINT        NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  click_count      BIGINT        NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  -- settings (stored as JSONB for flexibility; validated in app layer)
  autoplay         BOOLEAN       NOT NULL DEFAULT TRUE,
  autoplay_delay   INTEGER       NOT NULL DEFAULT 5000 CHECK (autoplay_delay >= 500),
  pause_on_hover   BOOLEAN       NOT NULL DEFAULT TRUE,
  loop             BOOLEAN       NOT NULL DEFAULT TRUE,
  speed            INTEGER       NOT NULL DEFAULT 600  CHECK (speed >= 0),
  effect           carousel_effect NOT NULL DEFAULT 'slide',
  slides_per_view  INTEGER       NOT NULL DEFAULT 1  CHECK (slides_per_view >= 1),
  space_between    INTEGER       NOT NULL DEFAULT 0  CHECK (space_between >= 0),
  show_arrows      BOOLEAN       NOT NULL DEFAULT TRUE,
  show_dots        BOOLEAN       NOT NULL DEFAULT TRUE,
  touch_enabled    BOOLEAN       NOT NULL DEFAULT TRUE,
  keyboard_enabled BOOLEAN       NOT NULL DEFAULT TRUE,
  lazy_load        BOOLEAN       NOT NULL DEFAULT TRUE,
  center_mode      BOOLEAN       NOT NULL DEFAULT FALSE,
  breakpoints      JSONB,
  created_by       TEXT          NOT NULL,
  updated_by       TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_carousel_location ON carousel (location);
CREATE INDEX idx_carousel_status   ON carousel (status);

-- ─────────────────────────────────────────────
-- 2. carousel_slide
-- ─────────────────────────────────────────────

CREATE TABLE carousel_slide (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id      UUID          NOT NULL REFERENCES carousel (id) ON DELETE CASCADE,
  type             slide_type    NOT NULL,
  status           slide_status  NOT NULL DEFAULT 'draft',
  slide_order      INTEGER       NOT NULL CHECK (slide_order >= 0),
  src              TEXT          NOT NULL CHECK (src <> ''),
  alt              TEXT,
  poster           TEXT,          -- required for video_mp4 (enforced in app layer)
  width            INTEGER       CHECK (width IS NULL OR width > 0),
  height           INTEGER       CHECK (height IS NULL OR height > 0),
  duration_seconds INTEGER       CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  muted            BOOLEAN       NOT NULL DEFAULT TRUE,  -- ALWAYS true; see video policy
  show_controls    BOOLEAN       NOT NULL DEFAULT TRUE,
  link_url         TEXT,
  link_target      TEXT          DEFAULT '_self' CHECK (link_target IN ('_self', '_blank')),
  analytics_label  TEXT,
  active_from      TIMESTAMPTZ,
  active_to        TIMESTAMPTZ,
  created_by       TEXT          NOT NULL,
  updated_by       TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT slide_date_order CHECK (
    active_to IS NULL OR active_from IS NULL OR active_to > active_from
  ),
  CONSTRAINT video_muted CHECK (
    type NOT IN ('video_mp4', 'youtube', 'vimeo') OR muted = TRUE
  )
);

CREATE INDEX idx_slide_carousel ON carousel_slide (carousel_id, slide_order);
CREATE INDEX idx_slide_status   ON carousel_slide (status);
CREATE INDEX idx_slide_active   ON carousel_slide (active_from, active_to)
  WHERE active_from IS NOT NULL OR active_to IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. carousel_slide_overlay
-- ─────────────────────────────────────────────

CREATE TABLE carousel_slide_overlay (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id    UUID          NOT NULL UNIQUE REFERENCES carousel_slide (id) ON DELETE CASCADE,
  heading     TEXT,
  subheading  TEXT,
  description TEXT,
  cta_text    TEXT,
  cta_url     TEXT,
  position    overlay_position NOT NULL DEFAULT 'bottom-left',
  text_color  TEXT          NOT NULL DEFAULT 'white' CHECK (text_color IN ('white', 'dark')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. carousel_analytics
-- ─────────────────────────────────────────────

CREATE TABLE carousel_analytics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id  UUID        NOT NULL UNIQUE REFERENCES carousel (id) ON DELETE CASCADE,
  total_views  BIGINT      NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  total_clicks BIGINT      NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
  ctr          NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_views = 0 THEN 0
         ELSE ROUND((total_clicks::NUMERIC / total_views) * 100, 2)
    END
  ) STORED,
  period_start TIMESTAMPTZ,
  period_end   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 5. carousel_slide_analytics
-- ─────────────────────────────────────────────

CREATE TABLE carousel_slide_analytics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id     UUID        NOT NULL REFERENCES carousel_slide (id) ON DELETE CASCADE,
  carousel_id  UUID        NOT NULL REFERENCES carousel (id) ON DELETE CASCADE,
  views        BIGINT      NOT NULL DEFAULT 0 CHECK (views >= 0),
  clicks       BIGINT      NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  play_events  BIGINT      NOT NULL DEFAULT 0 CHECK (play_events >= 0),
  ctr          NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN views = 0 THEN 0
         ELSE ROUND((clicks::NUMERIC / views) * 100, 2)
    END
  ) STORED,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slide_analytics_carousel ON carousel_slide_analytics (carousel_id);

-- ─────────────────────────────────────────────
-- 6. carousel_schedule
-- ─────────────────────────────────────────────

CREATE TABLE carousel_schedule (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id     UUID        NOT NULL REFERENCES carousel_slide (id) ON DELETE CASCADE,
  carousel_id  UUID        NOT NULL REFERENCES carousel (id) ON DELETE CASCADE,
  active_from  TIMESTAMPTZ NOT NULL,
  active_to    TIMESTAMPTZ NOT NULL,
  created_by   TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT schedule_date_order CHECK (active_to > active_from)
);

CREATE INDEX idx_schedule_slide    ON carousel_schedule (slide_id);
CREATE INDEX idx_schedule_active   ON carousel_schedule (active_from, active_to);

-- ─────────────────────────────────────────────
-- 7. carousel_audit
-- ─────────────────────────────────────────────

CREATE TABLE carousel_audit (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT        NOT NULL CHECK (entity_type IN ('carousel', 'slide', 'overlay')),
  entity_id     UUID        NOT NULL,
  action        TEXT        NOT NULL,
  changed_by    TEXT        NOT NULL,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity   ON carousel_audit (entity_type, entity_id);
CREATE INDEX idx_audit_actor    ON carousel_audit (changed_by);
CREATE INDEX idx_audit_created  ON carousel_audit (created_at DESC);

-- ─────────────────────────────────────────────
-- 8. carousel_notification
-- ─────────────────────────────────────────────

CREATE TABLE carousel_notification (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id    UUID        NOT NULL REFERENCES carousel (id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL CHECK (event_type IN ('published', 'paused', 'archived', 'slide_added', 'slide_removed')),
  recipient      TEXT        NOT NULL,
  novu_workflow  TEXT        NOT NULL DEFAULT 'carousel-admin-event',
  payload        JSONB,
  sent_at        TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_carousel ON carousel_notification (carousel_id);
CREATE INDEX idx_notif_status   ON carousel_notification (status) WHERE status = 'pending';

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_carousel_summary AS
SELECT
  c.id,
  c.name,
  c.location,
  c.status,
  c.view_count,
  c.click_count,
  CASE WHEN c.view_count = 0 THEN 0
       ELSE ROUND((c.click_count::NUMERIC / c.view_count) * 100, 2)
  END AS ctr_pct,
  COUNT(s.id) FILTER (WHERE s.status = 'active') AS active_slides,
  COUNT(s.id) AS total_slides,
  c.created_at,
  c.updated_at
FROM carousel c
LEFT JOIN carousel_slide s ON s.carousel_id = c.id
GROUP BY c.id;

CREATE OR REPLACE VIEW v_slide_performance AS
SELECT
  cs.id AS slide_id,
  cs.carousel_id,
  c.name AS carousel_name,
  c.location,
  cs.type,
  cs.alt,
  cs.slide_order,
  cs.status AS slide_status,
  COALESCE(sa.views, 0) AS views,
  COALESCE(sa.clicks, 0) AS clicks,
  COALESCE(sa.play_events, 0) AS play_events,
  COALESCE(sa.ctr, 0) AS ctr_pct
FROM carousel_slide cs
JOIN carousel c ON c.id = cs.carousel_id
LEFT JOIN carousel_slide_analytics sa ON sa.slide_id = cs.id;

CREATE OR REPLACE VIEW v_active_slides AS
SELECT
  cs.*,
  c.name AS carousel_name,
  c.location,
  c.status AS carousel_status,
  o.heading,
  o.subheading,
  o.cta_text,
  o.cta_url,
  o.position AS overlay_position
FROM carousel_slide cs
JOIN carousel c ON c.id = cs.carousel_id AND c.status = 'active'
LEFT JOIN carousel_slide_overlay o ON o.slide_id = cs.id
WHERE cs.status = 'active'
  AND (cs.active_from IS NULL OR cs.active_from <= now())
  AND (cs.active_to IS NULL OR cs.active_to > now())
ORDER BY cs.carousel_id, cs.slide_order;

-- ─────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['carousel', 'carousel_slide', 'carousel_slide_overlay'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
