-- ============================================================
-- Wave 10 — Referral Management Domain | SohamYoga Portal
-- ============================================================

-- ── 1. referral_campaign ─────────────────────────────────────────────────────
CREATE TABLE referral_campaign (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      VARCHAR(200) NOT NULL,
  slug                      VARCHAR(120) NOT NULL UNIQUE,
  type                      VARCHAR(30)  NOT NULL CHECK (type IN (
                              'standard','double_reward','flash','corporate','seasonal')),
  status                    VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN (
                              'draft','active','paused','ended')),
  reward_type               VARCHAR(30)  NOT NULL,
  referrer_reward_value     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (referrer_reward_value >= 0),
  referree_reward_value     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (referree_reward_value >= 0),
  max_referrals             INT          CHECK (max_referrals >= 1),
  max_reward_per_referrer   INT          CHECK (max_reward_per_referrer >= 1),
  eligible_referral_types   TEXT[]       NOT NULL,
  requires_membership_purchase BOOLEAN  NOT NULL DEFAULT TRUE,
  start_date                TIMESTAMPTZ  NOT NULL,
  end_date                  TIMESTAMPTZ,
  total_referrals           INT          NOT NULL DEFAULT 0 CHECK (total_referrals >= 0),
  total_rewards_paid        NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT at_least_one_reward CHECK (
    referrer_reward_value > 0 OR referree_reward_value > 0
  ),
  CONSTRAINT end_after_start CHECK (
    end_date IS NULL OR end_date > start_date
  )
);

-- ── 2. referral_code ─────────────────────────────────────────────────────────
CREATE TABLE referral_code (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50)  NOT NULL UNIQUE,
  referrer_id       UUID         NOT NULL, -- FK → customer.id or teacher.id
  referrer_type     VARCHAR(30)  NOT NULL CHECK (referrer_type IN (
                      'customer_customer','teacher_student','student_teacher',
                      'corporate','doctor','hospital','partner','influencer',
                      'affiliate','employee','franchise','event','workshop','retreat')),
  campaign_id       UUID         REFERENCES referral_campaign(id),
  referral_url      TEXT         NOT NULL,
  qr_code_url       TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN (
                      'active','paused','expired','revoked')),
  max_uses          INT          CHECK (max_uses >= 1),
  used_count        INT          NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  click_count       INT          NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_code_referrer ON referral_code(referrer_id);
CREATE INDEX idx_referral_code_campaign ON referral_code(campaign_id);
CREATE INDEX idx_referral_code_status   ON referral_code(status);

-- ── 3. referral_link ─────────────────────────────────────────────────────────
CREATE TABLE referral_link (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id  UUID         NOT NULL REFERENCES referral_code(id),
  channel           VARCHAR(30)  NOT NULL CHECK (channel IN (
                      'whatsapp','facebook','instagram','linkedin','x',
                      'telegram','qr_code','email','sms','direct_link','nfc')),
  utm_source        VARCHAR(100),
  utm_medium        VARCHAR(100),
  utm_campaign      VARCHAR(100),
  short_url         TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 4. referral_click ────────────────────────────────────────────────────────
CREATE TABLE referral_click (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id  UUID         NOT NULL REFERENCES referral_code(id),
  ip_address        INET,
  device_fingerprint TEXT,
  user_agent        TEXT,
  country           VARCHAR(3),
  channel           VARCHAR(30),
  clicked_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_click_code ON referral_click(referral_code_id);

-- ── 5. referral_master ───────────────────────────────────────────────────────
CREATE TABLE referral_master (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id  UUID         NOT NULL REFERENCES referral_code(id),
  referrer_id       UUID         NOT NULL,
  referree_email    VARCHAR(255) NOT NULL,
  referree_id       UUID,                  -- set when referree registers
  type              VARCHAR(30)  NOT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'draft' CHECK (status IN (
                      'draft','shared','clicked','registered','verified',
                      'membership_purchased','reward_pending','reward_approved',
                      'reward_rejected','reward_paid','expired')),
  channel           VARCHAR(30),
  utm_source        VARCHAR(100),
  utm_medium        VARCHAR(100),
  utm_campaign      VARCHAR(100),
  clicked_at        TIMESTAMPTZ,
  registered_at     TIMESTAMPTZ,
  verified_at       TIMESTAMPTZ,
  purchased_at      TIMESTAMPTZ,
  reward_paid_at    TIMESTAMPTZ,
  rejection_reason  TEXT,
  fraud_flags       TEXT[]       NOT NULL DEFAULT '{}',
  order_amount      NUMERIC(10,2) CHECK (order_amount >= 0),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_referrer  ON referral_master(referrer_id);
CREATE INDEX idx_referral_referree  ON referral_master(referree_email);
CREATE INDEX idx_referral_status    ON referral_master(status);
CREATE INDEX idx_referral_code_ref  ON referral_master(referral_code_id);

-- ── 6. referral_registration ─────────────────────────────────────────────────
CREATE TABLE referral_registration (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id       UUID         NOT NULL REFERENCES referral_master(id),
  referree_id       UUID         NOT NULL,
  registration_source VARCHAR(50),
  ip_address        INET,
  device_fingerprint TEXT,
  registered_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 7. referral_reward ───────────────────────────────────────────────────────
CREATE TABLE referral_reward (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id       UUID         NOT NULL REFERENCES referral_master(id),
  referrer_id       UUID         NOT NULL,
  referree_id       UUID         NOT NULL,
  reward_for        VARCHAR(20)  NOT NULL CHECK (reward_for IN ('referrer','referree')),
  type              VARCHAR(30)  NOT NULL CHECK (type IN (
                      'cash','wallet_credit','reward_points','membership_extension',
                      'free_class','discount_coupon','gift_card','merchandise',
                      'yoga_mat','meditation_course','vip_membership','workshop_access')),
  value             NUMERIC(10,2) NOT NULL CHECK (value > 0),
  currency          CHAR(3)      DEFAULT 'CAD',
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending','approved','rejected','paid','expired')),
  approved_by       UUID,
  rejected_by       UUID,
  rejection_reason  TEXT,
  paid_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reward_referral ON referral_reward(referral_id);
CREATE INDEX idx_reward_referrer ON referral_reward(referrer_id);
CREATE INDEX idx_reward_status   ON referral_reward(status);

-- ── 8. referral_wallet ───────────────────────────────────────────────────────
CREATE TABLE referral_wallet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID         NOT NULL UNIQUE,
  balance         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_spent  NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE referral_wallet_transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID         NOT NULL REFERENCES referral_wallet(id),
  type            VARCHAR(20)  NOT NULL CHECK (type IN ('credit','debit')),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reference_id    UUID,          -- referral_reward.id or order.id
  reference_type  VARCHAR(50),
  description     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 9. referral_campaign_analytics ──────────────────────────────────────────
CREATE TABLE referral_campaign_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID         NOT NULL REFERENCES referral_campaign(id),
  period_date     DATE         NOT NULL,
  clicks          INT          NOT NULL DEFAULT 0,
  registrations   INT          NOT NULL DEFAULT 0,
  verifications   INT          NOT NULL DEFAULT 0,
  purchases       INT          NOT NULL DEFAULT 0,
  rewards_issued  INT          NOT NULL DEFAULT 0,
  revenue         NUMERIC(12,2) NOT NULL DEFAULT 0,
  rewards_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (campaign_id, period_date)
);

-- ── 10. referral_audit ───────────────────────────────────────────────────────
CREATE TABLE referral_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id     UUID         NOT NULL REFERENCES referral_master(id),
  action          VARCHAR(60)  NOT NULL,
  performed_by    UUID,
  old_status      VARCHAR(30),
  new_status      VARCHAR(30),
  metadata        JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 11. referral_notification ────────────────────────────────────────────────
CREATE TABLE referral_notification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id     UUID         NOT NULL REFERENCES referral_master(id),
  recipient_id    UUID         NOT NULL,
  event           VARCHAR(60)  NOT NULL CHECK (event IN (
                    'referral_registered','referral_verified','reward_earned',
                    'reward_expired','coupon_generated','referral_rejected',
                    'leaderboard_update','reward_paid')),
  channel         VARCHAR(20)  NOT NULL CHECK (channel IN ('email','sms','push','in_app')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── VIEWS ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_referral_summary AS
SELECT
  rc.referrer_id,
  rc.code,
  rc.referrer_type,
  COUNT(rm.id)                                   AS total_referrals,
  COUNT(rm.id) FILTER (WHERE rm.status = 'reward_paid') AS successful_referrals,
  COUNT(rm.id) FILTER (WHERE rm.status = 'reward_pending') AS pending_referrals,
  SUM(rm.order_amount)                           AS total_revenue,
  COALESCE(rw.balance, 0)                        AS wallet_balance
FROM referral_code rc
LEFT JOIN referral_master rm ON rm.referral_code_id = rc.id
LEFT JOIN referral_wallet rw ON rw.customer_id = rc.referrer_id
GROUP BY rc.referrer_id, rc.code, rc.referrer_type, rw.balance;

CREATE OR REPLACE VIEW v_top_referrers AS
SELECT
  referrer_id,
  COUNT(id)                                    AS total_referrals,
  COUNT(id) FILTER (WHERE status = 'reward_paid') AS successful,
  ROUND(100.0 * COUNT(id) FILTER (WHERE status IN ('membership_purchased','reward_pending','reward_approved','reward_paid'))
    / NULLIF(COUNT(id), 0), 2)                 AS conversion_rate_pct,
  SUM(order_amount)                            AS total_revenue_generated
FROM referral_master
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY referrer_id
ORDER BY successful DESC, total_revenue_generated DESC;

CREATE OR REPLACE VIEW v_referral_campaign_performance AS
SELECT
  rc.id,
  rc.name,
  rc.type,
  rc.status,
  rc.total_referrals,
  rc.total_rewards_paid,
  COALESCE(SUM(ca.revenue), 0)                 AS total_revenue,
  ROUND(100.0 * SUM(ca.purchases)
    / NULLIF(SUM(ca.registrations), 0), 2)     AS conversion_rate_pct
FROM referral_campaign rc
LEFT JOIN referral_campaign_analytics ca ON ca.campaign_id = rc.id
GROUP BY rc.id, rc.name, rc.type, rc.status,
         rc.total_referrals, rc.total_rewards_paid;

-- ── INTEGRATION COMMENTS ──────────────────────────────────────────────────────
-- ERPNext: referral_wallet → Customer Wallet; reward payment → Journal Entry
-- Wave 7 Coupon: referral discount_coupon reward → coupon_master record
-- Wave 8 Pricing: referral membership_extension → PricingPlan.extend()
-- Wave 9 eCommerce: referral order_amount → sales_order.coupon_discount
-- PostHog: referral_registered, reward_earned, referral_rejected events
-- Novu (4001): all referral_notification events
-- Redis: referral code click dedup (SET NX TTL 60s per IP/code pair)
-- Frappe CRM: referral_master → CRM Lead when referree registers
-- GrowthBook: A/B test double_reward vs standard campaign types
