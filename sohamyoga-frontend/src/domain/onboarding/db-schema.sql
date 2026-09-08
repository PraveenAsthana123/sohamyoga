-- Customer Onboarding Wizard: confirmed zero implementation (grep, 2026-09-01)
-- -- new customers landed on their dashboard with goal_statement/
-- preferred_class_styles/preferred_class_times unset and no guided setup.
-- This adds completion tracking; the wizard itself writes into the real
-- existing customer + health_profile tables, no parallel data model needed.

ALTER TABLE customer ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'goals'
  CHECK (onboarding_step IN ('goals','schedule','health','notifications','done'));

-- Backfill: every customer that existed before this wizard shipped must not
-- be force-redirected into onboarding on their next login -- only customers
-- who register from this point forward should see it.
UPDATE customer SET onboarding_completed_at = created_at, onboarding_step = 'done' WHERE onboarding_completed_at IS NULL;
