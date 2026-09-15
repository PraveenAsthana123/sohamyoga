-- Vertical Pack Framework, added 2026-09-14 -- backlog item #20. For a
-- single-tenant instance that only operates in one real vertical
-- (yoga/wellness education), a framework for "many verticals" has one
-- real, honest entry -- the vertical this business actually is -- not
-- fabricated packs for Dental/Restaurant/Real-Estate/etc. this codebase
-- has no real data or business relationship to.

CREATE TABLE IF NOT EXISTS vertical_pack (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_key       VARCHAR(30)   NOT NULL UNIQUE,
  name               TEXT          NOT NULL,
  business_model_category VARCHAR(30) NOT NULL, -- real, matches business_profile.business_model_category
  real_kpi_dimensions TEXT[]       NOT NULL DEFAULT '{}', -- real dimension_keys from kpi_snapshot actually in use
  notes              TEXT          NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
