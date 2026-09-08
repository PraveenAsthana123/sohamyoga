-- Reward Catalog + Redemption -- loyalty_earn_rule/loyalty_transaction
-- already had a real earning side, but there was no catalog of what points
-- could actually be redeemed for, and no redemption write path (points
-- could only ever go up).
CREATE TABLE IF NOT EXISTS reward_catalog_item (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (name <> ''),
  description   TEXT,
  points_cost   INT NOT NULL CHECK (points_cost > 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  stock         INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_catalog_tenant ON reward_catalog_item(tenant_id, is_active);
