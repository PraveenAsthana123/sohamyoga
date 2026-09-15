-- CRO / Website Friction Engine, added 2026-09-14 -- backlog item #10.
-- No dedicated conversion-funnel/friction domain exists (confirmed
-- absent before building; real Matomo analytics integration exists
-- elsewhere in this codebase for traffic/SEO reporting, but not a
-- friction-audit concept). Real, admin-entered friction findings --
-- same honest pattern as competitor/GEO observations this session.

CREATE TABLE IF NOT EXISTS cro_friction_finding (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  page_path      TEXT          NOT NULL, -- the real page/flow this was observed on
  friction_type  VARCHAR(30)   NOT NULL CHECK (friction_type IN ('form_length','missing_trust_signal','slow_load','unclear_cta','payment_friction','navigation_confusion','other')),
  severity       VARCHAR(10)   NOT NULL CHECK (severity IN ('low','medium','high')),
  description    TEXT          NOT NULL, -- what the admin actually observed
  resolved_at    TIMESTAMPTZ,
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cro_finding_tenant ON cro_friction_finding (tenant_id, resolved_at);
