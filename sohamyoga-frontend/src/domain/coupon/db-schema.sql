-- Coupon & promotion engine — backs the Coupon.ts domain model, which already
-- encoded the full business logic (19 types, stacking rules, eligibility,
-- limits, blackout periods) but had no table until now.

CREATE TABLE IF NOT EXISTS coupon (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL,
  code               VARCHAR(40)  NOT NULL,
  coupon_type        VARCHAR(20)  NOT NULL CHECK (coupon_type IN (
                        'percentage','fixed_amount','free_class','buy_x_get_y','membership',
                        'bundle','referral','first_purchase','birthday','student_senior',
                        'corporate','teacher','event','product','free_shipping','gift_voucher',
                        'private_unique','public_promo','auto_applied')),
  name               VARCHAR(200) NOT NULL,
  description        TEXT         NOT NULL DEFAULT '',
  status             VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft','pending_approval','scheduled','active','paused','expired','exhausted','revoked')),

  discount           JSONB        NOT NULL,  -- CouponDiscount shape: {type, value, currency?, maxDiscountAmount?, freeUnits?, requiredUnits?}
  eligibility        JSONB        NOT NULL DEFAULT '{}',  -- CouponEligibility shape
  blackout_periods   JSONB        NOT NULL DEFAULT '[]',  -- BlackoutPeriod[]

  stacking_rule      VARCHAR(20)  NOT NULL DEFAULT 'exclusive' CHECK (stacking_rule IN ('combinable','exclusive','priority','best_discount')),
  stacking_priority  INTEGER      NOT NULL DEFAULT 0 CHECK (stacking_priority >= 0),
  membership_tier_preset VARCHAR(10) CHECK (membership_tier_preset IN ('none','bronze','silver','gold','platinum')),

  valid_from         TIMESTAMPTZ  NOT NULL,
  valid_to           TIMESTAMPTZ  NOT NULL,
  timezone           VARCHAR(50)  NOT NULL DEFAULT 'America/Edmonton',

  distribution_channels TEXT[]    NOT NULL DEFAULT '{}',
  is_auto_applied    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_single_use      BOOLEAN      NOT NULL DEFAULT FALSE,

  global_limit       INTEGER,                          -- NULL = unlimited
  per_customer_limit INTEGER      NOT NULL DEFAULT 1,
  per_order_limit    INTEGER      NOT NULL DEFAULT 1,
  daily_limit        INTEGER,
  current_redemptions INTEGER     NOT NULL DEFAULT 0,

  offerkit_id        VARCHAR(100),
  erpnext_id         VARCHAR(100),

  approved_by        VARCHAR(120),
  approved_at        TIMESTAMPTZ,
  revoked_by         VARCHAR(120),
  revoked_reason     TEXT,
  pause_reason       TEXT,

  notes              TEXT         NOT NULL DEFAULT '',
  created_by         VARCHAR(120) NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, code),
  CHECK (valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_coupon_status ON coupon(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_code   ON coupon(code);

CREATE TABLE IF NOT EXISTS coupon_redemption (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id     UUID         NOT NULL REFERENCES coupon(id) ON DELETE CASCADE,
  customer_id   UUID,
  order_id      UUID,
  discount_amount NUMERIC(10,2) NOT NULL,
  redeemed_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemption_coupon ON coupon_redemption(coupon_id);
