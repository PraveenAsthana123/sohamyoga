-- Customer persona: a distinct entity from brand_kit (brand identity --
-- colors, logo, fonts, tone words). brand_kit answers "who WE are";
-- customer_persona answers "who WE'RE TALKING TO". Closes the use_case_registry
-- gap "Brand DNA / brand persona vs customer persona distinction" -- before
-- this, the only persona-shaped data was a loose TEXT[] tag column
-- (campaign_brief.target_persona), not a structured, manageable entity.
CREATE TABLE IF NOT EXISTS customer_persona (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name                VARCHAR(120) NOT NULL,
  age_range           VARCHAR(20),
  goals               TEXT[]       NOT NULL DEFAULT '{}',
  pain_points         TEXT[]       NOT NULL DEFAULT '{}',
  preferred_channels  TEXT[]       NOT NULL DEFAULT '{}',
  notes               TEXT,
  is_default          BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by          VARCHAR(120) NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_customer_persona_tenant ON customer_persona (tenant_id);
