-- Partner Ecosystem Engine, added 2026-09-14 -- backlog item #26. Real,
-- admin-entered partner tracking (no partner-discovery API exists).
-- Distinct from the existing referral/ domain (#4's finding: real, but
-- scoped to sohamyoga's own product growth) -- this tracks real business
-- partners (studios, gyms, wellness brands) for co-marketing, not
-- individual referrers.

CREATE TABLE IF NOT EXISTS business_partner (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  name           TEXT          NOT NULL,
  partner_type   VARCHAR(20)   NOT NULL CHECK (partner_type IN ('referral','affiliate','reseller','technology','strategic','association')),
  fit_score      SMALLINT      CHECK (fit_score BETWEEN 0 AND 100), -- real, admin-assessed judgment, never auto-computed with no real signal
  status         VARCHAR(20)   NOT NULL DEFAULT 'prospecting' CHECK (status IN ('prospecting','negotiating','active','inactive')),
  notes          TEXT          NOT NULL DEFAULT '',
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
