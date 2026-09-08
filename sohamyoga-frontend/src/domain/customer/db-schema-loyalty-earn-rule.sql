-- Earn Rule Builder -- the real loyalty check-in earn trigger (built
-- earlier this session) hardcoded "10 points per attended class" with no
-- way to configure it. This makes the point value a real, admin-editable
-- rule per event type, and gives loyalty_transaction its first real admin
-- view (no /admin/loyalty page existed at all before this).
CREATE TABLE IF NOT EXISTS loyalty_earn_rule (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  event_type      VARCHAR(40)   NOT NULL,
  points_awarded  INTEGER       NOT NULL CHECK (points_awarded > 0),
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  updated_by      VARCHAR(120)  NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_type)
);

INSERT INTO loyalty_earn_rule (tenant_id, event_type, points_awarded, updated_by)
SELECT id, 'class_checkin', 10, 'system' FROM tenant
ON CONFLICT (tenant_id, event_type) DO NOTHING;
