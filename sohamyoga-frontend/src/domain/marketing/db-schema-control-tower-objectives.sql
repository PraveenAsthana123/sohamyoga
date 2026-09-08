-- Control Tower Objectives -- real, staff-set KPI targets for the Digital
-- Marketing Control Tower, compared against real actuals (the same
-- revenue/leads/bookings signals health_snapshot already captures), not a
-- static wishlist screen with fabricated numbers.
CREATE TABLE IF NOT EXISTS control_tower_objective (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  metric_key   VARCHAR(40)   NOT NULL CHECK (metric_key IN ('revenue_monthly','new_leads_monthly','bookings_monthly')),
  target_value NUMERIC(12,2) NOT NULL CHECK (target_value > 0),
  updated_by   VARCHAR(120)  NOT NULL,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_control_tower_objective ON control_tower_objective (tenant_id, metric_key);
