-- Business Diagnostic (Business Model Classifier + Demand Map + Funnel
-- Constraint Detection), added 2026-09-14 -- backlog item #8. For a
-- single-tenant dogfooding instance that already fully knows its own
-- business, an automated 12-category classifier over data we already
-- have is circular -- the real, honest version is a one-time admin
-- confirmation of the real category, not a model guessing what we
-- already know. Demand Map and Funnel Constraint reuse real data
-- already computed elsewhere in this session (class_session bookings,
-- the Opportunity Engine's #1-ranked candidate) rather than duplicating it.

CREATE TABLE IF NOT EXISTS business_profile (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL UNIQUE,
  business_model_category VARCHAR(30) NOT NULL CHECK (business_model_category IN (
    'local_service','professional_service','ecommerce','restaurant','subscription',
    'education','healthcare','marketplace','b2b_enterprise','franchise','multi_location','creator'
  )),
  confirmed_by          TEXT          NOT NULL, -- real admin who confirmed this, never auto-guessed
  notes                 TEXT          NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
