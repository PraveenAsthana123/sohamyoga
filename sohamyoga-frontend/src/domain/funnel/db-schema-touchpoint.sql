-- =============================================================================
-- Customer Journey, Funnel & Conversion Management — real touchpoint log.
-- Additive to the existing funnel domain (funnel_stage_snapshot /
-- funnel_transition_finding already existed and are untouched). The gap this
-- fills: no unified, individual-level log of a contact's real interactions
-- across channels — the existing engine only aggregates period-level counts.
-- This is the real, honest version of "conversion-path visualization": an
-- individual real timeline built from real INSERTs at the point real flows
-- already create a lead/registration, not a fabricated aggregate Sankey
-- diagram with no real volume behind it.
-- =============================================================================

CREATE TYPE journey_touchpoint_type AS ENUM (
  'form_submission', 'event_registration', 'booking', 'campaign_email',
  'landing_page_view', 'survey_response'
);

CREATE TABLE journey_touchpoint (
  id                 UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID                     NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  contact_identifier TEXT                     NOT NULL,
  touchpoint_type     journey_touchpoint_type NOT NULL,
  source_module      TEXT                     NOT NULL,
  occurred_at        TIMESTAMPTZ              NOT NULL DEFAULT now(),
  metadata           JSONB                    NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_journey_touchpoint_contact ON journey_touchpoint(tenant_id, contact_identifier, occurred_at DESC);
CREATE INDEX idx_journey_touchpoint_type ON journey_touchpoint(touchpoint_type);
