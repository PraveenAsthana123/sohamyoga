-- =============================================================================
-- Customer Funnel Stage Engine — the spine of the growth-loop architecture
-- (Customer Funnel → Advocacy/Referral → Viral Detection → Influencer).
--
-- Stages are deliberately scoped to what this platform actually tracks —
-- there is no ad-impression/reach data (no ad platform is connected), so
-- the funnel starts at real on-site engagement, not ad awareness/reach.
-- Seven stages, each backed by a real, already-flowing signal:
--   engagement  → tracking_event page_view/click
--   interest    → tracking_event click on a CTA (*_cta_click, *book_now_click)
--   intent      → tracking_event form_start/booking_started
--   lead        → campaign_lead rows created
--   conversion  → tracking_event booking_completed/payment_completed, or a
--                 real booking row with status confirmed/checked_in
--   experience  → survey_response submitted (NPS taken)
--   advocacy    → NPS promoters (individual score >= 9) among those responses
-- =============================================================================

CREATE TABLE IF NOT EXISTS funnel_stage_snapshot (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  period_start  DATE         NOT NULL,
  period_end    DATE         NOT NULL,
  stage         VARCHAR(30)  NOT NULL,
  stage_order   SMALLINT     NOT NULL,
  unique_count  INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start, period_end, stage)
);

CREATE INDEX IF NOT EXISTS idx_funnel_snapshot_period ON funnel_stage_snapshot (tenant_id, period_start DESC);

CREATE TABLE IF NOT EXISTS funnel_transition_finding (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  period_start     DATE         NOT NULL,
  period_end       DATE         NOT NULL,
  from_stage       VARCHAR(30)  NOT NULL,
  to_stage         VARCHAR(30)  NOT NULL,
  from_count       INTEGER      NOT NULL,
  to_count         INTEGER      NOT NULL,
  conversion_rate  NUMERIC(6,2) NOT NULL,
  is_leak          BOOLEAN      NOT NULL DEFAULT FALSE,
  ai_diagnosis     TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start, period_end, from_stage, to_stage)
);

CREATE INDEX IF NOT EXISTS idx_funnel_finding_period ON funnel_transition_finding (tenant_id, period_start DESC);
