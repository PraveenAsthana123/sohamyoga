-- Foundation Schema: Tenant · Organization · Module Config · Master/Reference Tables
-- Run this FIRST before any domain schema (Wave 14-20+)
-- Supports B2C (individual students) and B2B (studios, corporates, franchises)
-- Every domain table must carry tenant_id for row-level multi-tenancy

-- ─────────────────────────────────────────────
-- FOUNDATION ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE tenant_type   AS ENUM ('b2c', 'b2b_studio', 'b2b_corporate', 'b2b_franchise');
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE plan_tier     AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE user_role     AS ENUM ('owner', 'admin', 'staff', 'teacher', 'student', 'guest');
CREATE TYPE module_scope  AS ENUM ('student', 'teacher', 'admin', 'all');

-- ─────────────────────────────────────────────
-- 1. tenant — the top-level unit for multi-tenancy
-- B2C: one tenant per student (auto-created on registration)
-- B2B: one tenant per studio / company / franchise
-- ─────────────────────────────────────────────

CREATE TABLE tenant (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          NOT NULL CHECK (name <> ''),
  slug            TEXT          NOT NULL UNIQUE,         -- URL-safe: 'soham-yoga-mumbai'
  type            tenant_type   NOT NULL DEFAULT 'b2c',
  plan            plan_tier     NOT NULL DEFAULT 'starter',
  status          tenant_status NOT NULL DEFAULT 'trial',
  owner_user_id   UUID,                                  -- set after first user is created
  max_users       INTEGER       NOT NULL DEFAULT 1 CHECK (max_users >= 1),
  timezone        TEXT          NOT NULL DEFAULT 'UTC',
  locale          TEXT          NOT NULL DEFAULT 'en-CA',
  currency        TEXT          NOT NULL DEFAULT 'CAD',
  logo_url        TEXT,
  primary_color   TEXT          CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  trial_ends_at   TIMESTAMPTZ,
  activated_at    TIMESTAMPTZ,
  suspended_at    TIMESTAMPTZ,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_slug    ON tenant (slug);
CREATE INDEX idx_tenant_type    ON tenant (type);
CREATE INDEX idx_tenant_status  ON tenant (status);
CREATE INDEX idx_tenant_owner   ON tenant (owner_user_id);

-- ─────────────────────────────────────────────
-- 2. organization — sub-unit of a tenant (branch, department, franchise location)
-- B2C: auto-created for each tenant (single "personal" org)
-- B2B: multiple orgs per tenant (Mumbai HQ, Delhi branch, etc.)
-- ─────────────────────────────────────────────

CREATE TABLE organization (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID  NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  name          TEXT  NOT NULL CHECK (name <> ''),
  branch_code   TEXT,             -- franchise: 'BOM-001', 'DEL-002'
  address       TEXT,
  city          TEXT,
  country       TEXT  NOT NULL DEFAULT 'CA',
  phone         TEXT,
  email         TEXT,
  timezone      TEXT,             -- overrides tenant timezone if set
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, branch_code)
);

CREATE INDEX idx_org_tenant   ON organization (tenant_id);
CREATE UNIQUE INDEX idx_org_default ON organization (tenant_id) WHERE is_default = TRUE;

-- ─────────────────────────────────────────────
-- 3. app_user — every portal user tied to exactly one tenant
-- When a new user registers (B2C) → auto-create tenant + organization + app_user
-- ─────────────────────────────────────────────

CREATE TABLE app_user (
  id             UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID       NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  org_id         UUID       REFERENCES organization (id) ON DELETE SET NULL,
  email          TEXT       NOT NULL,
  display_name   TEXT       NOT NULL CHECK (display_name <> ''),
  role           user_role  NOT NULL DEFAULT 'student',
  status         TEXT       NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  auth_provider  TEXT       NOT NULL DEFAULT 'email',  -- 'email','google','apple','sso'
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_user_tenant ON app_user (tenant_id);
CREATE INDEX idx_user_email  ON app_user (tenant_id, email);
CREATE INDEX idx_user_role   ON app_user (tenant_id, role);
CREATE INDEX idx_user_status ON app_user (tenant_id, status) WHERE status = 'active';

-- ─────────────────────────────────────────────
-- 4. module_config — per-tenant on/off switch for every feature module
-- Backed by FeatureFlag.ts domain model; Admin UI reads/writes this table.
-- When enabled = FALSE → frontend hides the module entirely.
-- Seeded from DEFAULT_FEATURE_FLAGS on tenant creation.
-- ─────────────────────────────────────────────

CREATE TABLE module_config (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  module_key       TEXT         NOT NULL,  -- 'booking.class_catalog', 'journey.habit_tracker'
  module_name      TEXT         NOT NULL,
  category         TEXT         NOT NULL,  -- FeatureCategory: 'booking','ai','wellness', etc.
  scope            module_scope NOT NULL DEFAULT 'all',
  enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
  rollout_percent  SMALLINT     NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  allowed_roles    TEXT[]       NOT NULL DEFAULT '{}',
  description      TEXT,
  metadata         JSONB        NOT NULL DEFAULT '{}',
  updated_by       TEXT         NOT NULL DEFAULT 'system',
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, module_key)
);

CREATE INDEX idx_mc_tenant    ON module_config (tenant_id);
CREATE INDEX idx_mc_key       ON module_config (module_key);
CREATE INDEX idx_mc_enabled   ON module_config (tenant_id, enabled) WHERE enabled = TRUE;
CREATE INDEX idx_mc_category  ON module_config (tenant_id, category);
CREATE INDEX idx_mc_scope     ON module_config (tenant_id, scope);

-- ─────────────────────────────────────────────
-- 5. module_config_audit — full history of every enable/disable action
-- ─────────────────────────────────────────────

CREATE TABLE module_config_audit (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID  NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  module_key   TEXT  NOT NULL,
  module_name  TEXT,
  old_enabled  BOOLEAN,
  new_enabled  BOOLEAN NOT NULL,
  changed_by   TEXT NOT NULL,
  reason       TEXT,
  ip_address   INET,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mca_tenant  ON module_config_audit (tenant_id, changed_at DESC);
CREATE INDEX idx_mca_key     ON module_config_audit (module_key, changed_at DESC);
CREATE INDEX idx_mca_changed ON module_config_audit (changed_at DESC);

-- ─────────────────────────────────────────────
-- MASTER / REFERENCE TABLES
-- Lookup tables for domain enums — managed via admin UI; no hardcoded enums needed
-- ─────────────────────────────────────────────

-- 6. ref_health_condition
CREATE TABLE ref_health_condition (
  code        TEXT    PRIMARY KEY,
  label       TEXT    NOT NULL,
  description TEXT,
  icd10_code  TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_health_condition (code, label, icd10_code, sort_order) VALUES
  ('diabetes',      'Diabetes',      'E11',  1),
  ('hypertension',  'Hypertension',  'I10',  2),
  ('asthma',        'Asthma',        'J45',  3),
  ('arthritis',     'Arthritis',     'M06',  4),
  ('heart_disease', 'Heart Disease', 'I25',  5),
  ('osteoporosis',  'Osteoporosis',  'M81',  6),
  ('anxiety',       'Anxiety',       'F41',  7),
  ('depression',    'Depression',    'F32',  8),
  ('migraine',      'Migraine',      'G43',  9),
  ('chronic_pain',  'Chronic Pain',  'G89', 10);

-- 7. ref_allergy
CREATE TABLE ref_allergy (
  code       TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_allergy (code, label, sort_order) VALUES
  ('latex',     'Latex',     1),
  ('dust',      'Dust',      2),
  ('pollen',    'Pollen',    3),
  ('nuts',      'Nuts',      4),
  ('dairy',     'Dairy',     5),
  ('gluten',    'Gluten',    6),
  ('fragrance', 'Fragrance', 7),
  ('mold',      'Mold',      8);

-- 8. ref_injury_area
CREATE TABLE ref_injury_area (
  code       TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  body_side  TEXT    CHECK (body_side IN ('front','back','both')),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_injury_area (code, label, body_side, sort_order) VALUES
  ('neck',       'Neck',        'back',   1),
  ('shoulder',   'Shoulder',    'both',   2),
  ('upper_back', 'Upper Back',  'back',   3),
  ('lower_back', 'Lower Back',  'back',   4),
  ('hip',        'Hip',         'both',   5),
  ('knee',       'Knee',        'front',  6),
  ('ankle',      'Ankle',       'both',   7),
  ('wrist',      'Wrist',       'both',   8),
  ('elbow',      'Elbow',       'both',   9),
  ('hamstring',  'Hamstring',   'back',  10);

-- 9. ref_yoga_style
CREATE TABLE ref_yoga_style (
  code        TEXT    PRIMARY KEY,
  label       TEXT    NOT NULL,
  difficulty  TEXT    CHECK (difficulty IN ('beginner','intermediate','advanced','all')),
  description TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_yoga_style (code, label, difficulty, sort_order) VALUES
  ('hatha',       'Hatha',       'beginner',      1),
  ('vinyasa',     'Vinyasa',     'intermediate',  2),
  ('ashtanga',    'Ashtanga',    'advanced',      3),
  ('yin',         'Yin',         'all',           4),
  ('restorative', 'Restorative', 'beginner',      5),
  ('kundalini',   'Kundalini',   'intermediate',  6),
  ('iyengar',     'Iyengar',     'all',           7),
  ('prenatal',    'Prenatal',    'all',           8),
  ('kids',        'Kids',        'all',           9),
  ('senior',      'Senior',      'all',          10);

-- 10. ref_practice_goal
CREATE TABLE ref_practice_goal (
  code       TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_practice_goal (code, label, sort_order) VALUES
  ('stress_relief',   'Stress Relief',    1),
  ('flexibility',     'Flexibility',      2),
  ('strength',        'Strength',         3),
  ('sleep',           'Better Sleep',     4),
  ('weight_loss',     'Weight Loss',      5),
  ('mindfulness',     'Mindfulness',      6),
  ('injury_recovery', 'Injury Recovery',  7),
  ('spiritual',       'Spiritual Growth', 8),
  ('general_fitness', 'General Fitness',  9);

-- 11. ref_wearable_platform
CREATE TABLE ref_wearable_platform (
  code       TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  oauth_url  TEXT,
  api_docs   TEXT,
  enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO ref_wearable_platform (code, label, enabled, sort_order) VALUES
  ('fitbit',         'Fitbit',          FALSE, 1),
  ('garmin',         'Garmin Connect',  FALSE, 2),
  ('apple_health',   'Apple Health',    FALSE, 3),
  ('google_fit',     'Google Fit',      FALSE, 4),
  ('samsung_health', 'Samsung Health',  FALSE, 5),
  ('polar',          'Polar',           FALSE, 6);

-- 12. ref_milestone_type
CREATE TABLE ref_milestone_type (
  code       TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  description TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_milestone_type (code, label, sort_order) VALUES
  ('first_class',      'First Class',        1),
  ('streak_7',         '7-Day Streak',        2),
  ('streak_30',        '30-Day Streak',       3),
  ('streak_90',        '90-Day Streak',       4),
  ('streak_365',       '1-Year Streak',       5),
  ('classes_10',       '10 Classes',          6),
  ('classes_50',       '50 Classes',          7),
  ('classes_100',      '100 Classes',         8),
  ('classes_500',      '500 Classes',         9),
  ('goal_achieved',    'Goal Achieved',      10),
  ('phase_advanced',   'Phase Advanced',     11),
  ('year_anniversary', 'Year Anniversary',   12),
  ('referral_bonus',   'Referral Bonus',     13);

-- 13. ref_module_category — all feature categories
CREATE TABLE ref_module_category (
  code        TEXT    PRIMARY KEY,
  label       TEXT    NOT NULL,
  description TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO ref_module_category (code, label, sort_order) VALUES
  ('booking',      'Booking',           1),
  ('membership',   'Membership',        2),
  ('ai',           'AI Features',       3),
  ('community',    'Community',         4),
  ('gamification', 'Gamification',      5),
  ('wellness',     'Wellness',          6),
  ('campaign',     'Campaigns',         7),
  ('notification', 'Notifications',     8),
  ('payment',      'Payments',          9),
  ('analytics',    'Analytics',        10),
  ('integration',  'Integrations',     11),
  ('content',      'Content',          12),
  ('teacher',      'Teacher Portal',   13),
  ('hr',           'HR',               14),
  ('coupon',       'Coupons',          15),
  ('pricing',      'Pricing',          16),
  ('ecommerce',    'eCommerce',        17),
  ('referral',     'Referral',         18),
  ('survey',       'Surveys',          19),
  ('carousel',     'Carousel',         20),
  ('chat',         'Chat',             21),
  ('ads',          'Ads Platform',     22),
  ('journey',      'Customer Journey', 23);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_tenant_module_status AS
SELECT
  t.id            AS tenant_id,
  t.name          AS tenant_name,
  t.type          AS tenant_type,
  t.plan,
  mc.module_key,
  mc.module_name,
  mc.category,
  mc.scope,
  mc.enabled,
  mc.rollout_percent,
  mc.updated_by,
  mc.updated_at
FROM tenant t
JOIN module_config mc ON mc.tenant_id = t.id
ORDER BY t.name, mc.category, mc.module_key;

CREATE OR REPLACE VIEW v_tenant_summary AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.type,
  t.plan,
  t.status,
  COUNT(DISTINCT u.id)                                               AS user_count,
  COUNT(DISTINCT o.id)                                               AS org_count,
  COUNT(DISTINCT mc.id)                                              AS total_modules,
  COUNT(DISTINCT mc.id) FILTER (WHERE mc.enabled = TRUE)            AS enabled_modules,
  COUNT(DISTINCT mc.id) FILTER (WHERE mc.enabled = FALSE)           AS disabled_modules,
  ROUND(
    COUNT(DISTINCT mc.id) FILTER (WHERE mc.enabled = TRUE)::NUMERIC
    / NULLIF(COUNT(DISTINCT mc.id), 0) * 100, 1
  ) AS module_adoption_pct
FROM tenant t
LEFT JOIN app_user      u  ON u.tenant_id  = t.id
LEFT JOIN organization  o  ON o.tenant_id  = t.id
LEFT JOIN module_config mc ON mc.tenant_id = t.id
GROUP BY t.id;

-- ─────────────────────────────────────────────
-- updated_at trigger function (shared across all schemas)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['tenant','organization','app_user','module_config'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- B2C BOOTSTRAP: auto-create tenant + org when a user registers
-- Called by the application layer after auth provider creates the user
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION bootstrap_b2c_tenant(
  p_user_id   UUID,
  p_email     TEXT,
  p_name      TEXT,
  p_timezone  TEXT DEFAULT 'UTC'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_tenant_id UUID;
  v_org_id    UUID;
  v_slug      TEXT;
BEGIN
  -- URL-safe slug: "Praveen Asthana" → "praveen-asthana-a1b2c3d4"
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || left(p_user_id::TEXT, 8);

  INSERT INTO tenant (name, slug, type, plan, status, owner_user_id, max_users, timezone)
  VALUES (p_name, v_slug, 'b2c', 'starter', 'trial', p_user_id, 1, p_timezone)
  RETURNING id INTO v_tenant_id;

  INSERT INTO organization (tenant_id, name, is_default)
  VALUES (v_tenant_id, p_name || '''s Studio', TRUE)
  RETURNING id INTO v_org_id;

  -- Application layer seeds module_config from DEFAULT_FEATURE_FLAGS

  RETURN v_tenant_id;
END; $$;

-- ─────────────────────────────────────────────
-- B2B BOOTSTRAP: create tenant for a studio / company
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION bootstrap_b2b_tenant(
  p_org_name    TEXT,
  p_type        tenant_type,  -- 'b2b_studio', 'b2b_corporate', 'b2b_franchise'
  p_plan        plan_tier,
  p_max_users   INTEGER DEFAULT 50,
  p_timezone    TEXT    DEFAULT 'UTC'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_tenant_id UUID;
  v_slug      TEXT;
BEGIN
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || left(gen_random_uuid()::TEXT, 8);

  INSERT INTO tenant (name, slug, type, plan, status, max_users, timezone)
  VALUES (p_org_name, v_slug, p_type, p_plan, 'trial', p_max_users, p_timezone)
  RETURNING id INTO v_tenant_id;

  INSERT INTO organization (tenant_id, name, is_default)
  VALUES (v_tenant_id, p_org_name, TRUE);

  RETURN v_tenant_id;
END; $$;
