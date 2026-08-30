-- =============================================================================
-- Event, Webinar, Workshop & Seminar Management — Module 19 of the 25-item
-- marketing management list. Was 0/14: nothing distinct from recurring
-- yoga-class booking (class_session/booking) existed for one-off/public
-- events. This adds a real event registry with public (non-student)
-- registration, capacity enforcement, and check-in — the concrete slice this
-- app can support today. Deferred (documented, not silently dropped): calendar
-- sync (ICS/Google Calendar), automated reminder emails, live-stream/video
-- integration, speaker/session sub-agenda management, certificate issuance —
-- none have a real consumer wired up yet (no email-sending job, no calendar
-- integration, no video provider credential exists in this repo).
-- =============================================================================

CREATE TYPE event_occasion_type AS ENUM ('event', 'webinar', 'workshop', 'seminar');
CREATE TYPE event_occasion_format AS ENUM ('in_person', 'online', 'hybrid');
CREATE TYPE event_occasion_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE event_registration_status AS ENUM ('registered', 'cancelled', 'attended', 'no_show');

CREATE TABLE event (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID           NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  slug            TEXT           NOT NULL,
  title           TEXT           NOT NULL CHECK (title <> ''),
  description     TEXT           NOT NULL DEFAULT '',
  type            event_occasion_type    NOT NULL,
  format          event_occasion_format  NOT NULL,
  location        TEXT,
  join_url        TEXT,
  starts_at       TIMESTAMPTZ    NOT NULL,
  ends_at         TIMESTAMPTZ    NOT NULL,
  capacity        INTEGER        CHECK (capacity IS NULL OR capacity > 0),
  status          event_occasion_status  NOT NULL DEFAULT 'draft',
  registration_count INTEGER     NOT NULL DEFAULT 0 CHECK (registration_count >= 0),
  created_by      TEXT           NOT NULL,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_event_tenant ON event(tenant_id);
CREATE INDEX idx_event_status ON event(status);
CREATE INDEX idx_event_starts_at ON event(starts_at);

CREATE TABLE event_registration (
  id            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID                       NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  name          TEXT                       NOT NULL CHECK (name <> ''),
  email         TEXT                       NOT NULL,
  phone         TEXT,
  status        event_registration_status  NOT NULL DEFAULT 'registered',
  lead_id       UUID                       REFERENCES campaign_lead(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ                NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  UNIQUE (event_id, email)
);

CREATE INDEX idx_event_registration_event ON event_registration(event_id, status);
