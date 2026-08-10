-- ============================================================
-- SOHAM YOGA PORTAL — PRICING ENGINE MASTER TABLES
-- Wave 8 — Pricing Engine
-- Backed by: PostgreSQL 15 (ERPNext + Medusa) + Redis (locks)
-- ============================================================

-- ============================================================
-- MASTER / REFERENCE TABLES
-- ============================================================

-- [1] PLAN MASTER — membership catalog (Silver/Gold/Platinum/Family/Corporate/…)
CREATE TABLE IF NOT EXISTS pricing_plan_master (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      VARCHAR(100) NOT NULL,
  slug                      VARCHAR(100) NOT NULL UNIQUE,
  plan_type                 VARCHAR(30)  NOT NULL CHECK (plan_type IN (
                              'silver','gold','platinum','family','corporate',
                              'kids','senior','retreat','workshop','personal_training',
                              'trial','drop_in')),
  description               TEXT,
  status                    VARCHAR(20)  NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','active','deprecated','archived')),
  grace_period_days         INT          NOT NULL DEFAULT 7,
  -- Policies (stored as JSONB for flexibility)
  freeze_policy             JSONB        NOT NULL DEFAULT '{"allowed":false,"maxDaysPerYear":0,"noticeDaysRequired":0,"maxTimesPerYear":0}',
  pause_policy              JSONB        NOT NULL DEFAULT '{"allowed":false,"maxDaysPerYear":0,"maxTimesPerYear":0,"noticeDaysRequired":0}',
  benefits                  JSONB        NOT NULL DEFAULT '{}',
  upgradeable_to            TEXT[]       DEFAULT '{}',
  downgradeable_to          TEXT[]       DEFAULT '{}',
  family_config             JSONB,       -- {maxSeats, sharedClassCredits, sharedWallet}
  corporate_config          JSONB,       -- {minEmployees, departmentSubaccounts, bulkInvoicing}
  trial_days                INT,
  trial_eligibility         VARCHAR(30)  CHECK (trial_eligibility IN ('first_time_only','no_prior_membership','any')),
  is_giftable               BOOLEAN      NOT NULL DEFAULT false,
  is_transferable           BOOLEAN      NOT NULL DEFAULT false,
  ab_test_variant_id        VARCHAR(50),
  sort_order                INT          NOT NULL DEFAULT 0,
  metadata                  JSONB        DEFAULT '{}',
  created_by                VARCHAR(100) NOT NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [2] PLAN PRICE MASTER — multi-currency, multi-cycle pricing for each plan
CREATE TABLE IF NOT EXISTS pricing_plan_price (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID         NOT NULL REFERENCES pricing_plan_master(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency            CHAR(3)      NOT NULL,                   -- 'CAD','USD','INR'
  billing_cycle       VARCHAR(20)  NOT NULL CHECK (billing_cycle IN (
                        'daily','weekly','monthly','quarterly','annual','one_time')),
  is_promotional      BOOLEAN      NOT NULL DEFAULT false,
  promo_valid_from    TIMESTAMPTZ,
  promo_valid_to      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (plan_id, currency, billing_cycle, is_promotional)
);

-- [3] PRICING RULE MASTER — 13 rule types, condition + action engine
CREATE TABLE IF NOT EXISTS pricing_rule_master (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(100) NOT NULL,
  description                 TEXT,
  rule_type                   VARCHAR(30)  NOT NULL CHECK (rule_type IN (
                                'buy_x_get_y','percentage_off','fixed_amount_off',
                                'free_item','membership_upgrade_credit','early_bird',
                                'last_minute','seasonal','peak_off_peak','occupancy_based',
                                'birthday','first_purchase','referral_reward')),
  status                      VARCHAR(20)  NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','paused','exhausted','archived')),
  priority                    INT          NOT NULL DEFAULT 100,
  stacking_behavior           VARCHAR(20)  NOT NULL DEFAULT 'combinable'
                                CHECK (stacking_behavior IN ('combinable','exclusive','best_wins')),
  condition_json              JSONB        NOT NULL DEFAULT '{}',
  action_json                 JSONB        NOT NULL DEFAULT '{}',
  max_applications_per_customer INT,
  max_applications_total      INT,
  current_applications        INT          NOT NULL DEFAULT 0,
  notes                       TEXT,
  created_by                  VARCHAR(100) NOT NULL,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [4] BUNDLE MASTER — class packs, hybrid bundles, retreat/workshop/gift bundles
CREATE TABLE IF NOT EXISTS bundle_master (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  slug                VARCHAR(100) NOT NULL UNIQUE,
  bundle_type         VARCHAR(30)  NOT NULL CHECK (bundle_type IN (
                        'class_pack','unlimited_monthly','unlimited_yearly','hybrid',
                        'retreat','workshop','teacher_training','corporate','family',
                        'kids','senior','gift','custom')),
  description         TEXT,
  status              VARCHAR(20)  NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','suspended','archived')),
  base_price          NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  discounted_price    NUMERIC(10,2) NOT NULL CHECK (discounted_price >= 0),
  currency            CHAR(3)      NOT NULL DEFAULT 'CAD',
  expiry_days         INT          NOT NULL CHECK (expiry_days >= 1),
  is_mix_and_match    BOOLEAN      NOT NULL DEFAULT false,
  is_giftable         BOOLEAN      NOT NULL DEFAULT false,
  is_transferable     BOOLEAN      NOT NULL DEFAULT false,
  seats_total         INT,         -- for corporate multi-seat bundles
  notes               TEXT,
  created_by          VARCHAR(100) NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [5] BUNDLE ITEM — line items within a bundle
CREATE TABLE IF NOT EXISTS bundle_item (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id           UUID         NOT NULL REFERENCES bundle_master(id) ON DELETE CASCADE,
  item_type           VARCHAR(20)  NOT NULL CHECK (item_type IN (
                        'class','workshop','retreat','product','consultation','content')),
  name                VARCHAR(100) NOT NULL,
  quantity            INT          NOT NULL CHECK (quantity >= 1),
  product_id          VARCHAR(100),
  class_category      VARCHAR(100),
  sort_order          INT          NOT NULL DEFAULT 0
);

-- [6] SUBSCRIPTION MASTER — active customer subscriptions
CREATE TABLE IF NOT EXISTS subscription_master (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               VARCHAR(100) NOT NULL,
  plan_id                   UUID         NOT NULL REFERENCES pricing_plan_master(id),
  plan_name                 VARCHAR(100) NOT NULL,
  plan_type                 VARCHAR(30)  NOT NULL,
  status                    VARCHAR(20)  NOT NULL DEFAULT 'trial'
                              CHECK (status IN ('trial','active','paused','frozen','grace_period','expired','cancelled')),
  billing_cycle             VARCHAR(20)  NOT NULL,
  billing_amount            NUMERIC(10,2) NOT NULL CHECK (billing_amount >= 0),
  currency                  CHAR(3)      NOT NULL DEFAULT 'CAD',
  billing_cycle_days        INT          NOT NULL CHECK (billing_cycle_days >= 1),
  started_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at                TIMESTAMPTZ  NOT NULL,
  renews_at                 TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  cancel_reason             TEXT,
  paused_at                 TIMESTAMPTZ,
  pause_reason              TEXT,
  frozen_from               TIMESTAMPTZ,
  frozen_to                 TIMESTAMPTZ,
  grace_period_ends_at      TIMESTAMPTZ,
  auto_renew                BOOLEAN      NOT NULL DEFAULT true,
  pending_downgrade_plan_id UUID         REFERENCES pricing_plan_master(id),
  corporate_department      VARCHAR(100),
  corporate_contract_id     VARCHAR(100),
  proration_credit          NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes                     TEXT,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_customer ON subscription_master(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status   ON subscription_master(status);
CREATE INDEX IF NOT EXISTS idx_subscription_expires  ON subscription_master(expires_at);

-- [7] FAMILY SEAT — seats within a family subscription
CREATE TABLE IF NOT EXISTS family_seat (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID         NOT NULL REFERENCES subscription_master(id) ON DELETE CASCADE,
  customer_id     VARCHAR(100) NOT NULL,
  member_name     VARCHAR(100) NOT NULL,
  added_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  status          VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  UNIQUE (subscription_id, customer_id)
);

-- [8] BUNDLE OWNERSHIP — tracks which customer owns each bundle instance
CREATE TABLE IF NOT EXISTS bundle_ownership (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id           UUID         NOT NULL REFERENCES bundle_master(id),
  customer_id         VARCHAR(100) NOT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','expired','transferred')),
  activated_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  gifted_to           VARCHAR(100),
  purchased_by        VARCHAR(100),
  transferred_to      VARCHAR(100),
  transferred_at      TIMESTAMPTZ,
  corporate_dept      VARCHAR(100),
  seats_used          INT          NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [9] BUNDLE USAGE — per-item-type credit consumption
CREATE TABLE IF NOT EXISTS bundle_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ownership_id    UUID         NOT NULL REFERENCES bundle_ownership(id),
  item_id         UUID         NOT NULL REFERENCES bundle_item(id),
  used_count      INT          NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  UNIQUE (ownership_id, item_id)
);

-- [10] PRICE HISTORY — immutable audit log of every price change
CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(30)  NOT NULL CHECK (entity_type IN ('plan','bundle','rule','subscription')),
  entity_id       UUID         NOT NULL,
  field_changed   VARCHAR(100) NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  change_reason   TEXT,
  changed_by      VARCHAR(100) NOT NULL,
  changed_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_entity ON price_history(entity_type, entity_id);

-- ============================================================
-- VIEWS FOR REPORTING
-- ============================================================

CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT
  s.id,
  s.customer_id,
  p.name            AS plan_name,
  p.plan_type,
  s.status,
  s.billing_cycle,
  s.billing_amount,
  s.currency,
  s.expires_at,
  s.auto_renew,
  s.proration_credit,
  COUNT(fs.id)      AS family_seat_count
FROM subscription_master s
JOIN pricing_plan_master  p  ON p.id = s.plan_id
LEFT JOIN family_seat     fs ON fs.subscription_id = s.id AND fs.status = 'active'
WHERE s.status IN ('active','trial','grace_period')
GROUP BY s.id, p.name, p.plan_type;

CREATE OR REPLACE VIEW v_revenue_by_plan AS
SELECT
  p.name AS plan_name,
  p.plan_type,
  s.billing_cycle,
  s.currency,
  COUNT(s.id)            AS active_subscriptions,
  SUM(s.billing_amount)  AS mrr_amount,
  AVG(s.billing_amount)  AS avg_billing_amount
FROM subscription_master s
JOIN pricing_plan_master  p ON p.id = s.plan_id
WHERE s.status = 'active'
GROUP BY p.name, p.plan_type, s.billing_cycle, s.currency
ORDER BY mrr_amount DESC;

-- ============================================================
-- INTEGRATION REFERENCE
-- ============================================================
-- ERPNext / Frappe:    subscription_master → Sales Invoice + Payment Entry
--                      bundle_ownership    → Item + Stock Entry
--                      price_history       → Price List + Pricing Rule
-- Medusa:              pricing_plan_master → Product Variant Prices
--                      subscription_master → Orders + Customers
-- OfferKit:            pricing_rule_master synced via webhook POST /rules
-- Redis:               subscription upgrade/downgrade locks
--                      Key: lock:subscription:{id}  TTL=30s
-- PostHog:             A/B test on ab_test_variant_id field
--                      Events: plan_viewed, plan_selected, plan_upgraded, plan_cancelled
-- Novu:                Triggers on expires_at - 7 days (renewal reminder)
--                      Triggers on grace_period_ends_at - 2 days (final warning)
