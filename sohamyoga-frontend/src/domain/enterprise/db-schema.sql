-- =============================================================================
-- Wave 20: Enterprise & Multi-Branch — DB Schema
-- Table-driven: all enum codes reference ref_* lookup tables
-- Tenant-driven: tenant_id FK on every domain table
-- Model-driven: Branch + FranchiseAgreement + CorporateWellnessProgram + WhiteLabelConfig
-- Run AFTER: src/domain/core/db-foundation.sql
-- =============================================================================

-- ─── Reference / Master Tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_branch_type (
  code        VARCHAR(20) PRIMARY KEY,
  label       VARCHAR(60) NOT NULL,
  description TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_branch_type (code, label, description, sort_order) VALUES
  ('franchise',      'Franchise',       'Independently owned under franchise agreement', 1),
  ('corporate_owned','Corporate Owned', 'Directly owned and operated by the parent',     2),
  ('partner',        'Partner',         'Strategic partner location',                    3),
  ('virtual',        'Virtual',         'Online-only branch with no physical location',  4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_branch_status (
  code        VARCHAR(20) PRIMARY KEY,
  label       VARCHAR(40) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO ref_branch_status (code, label, is_terminal) VALUES
  ('pending_setup', 'Pending Setup', FALSE),
  ('active',        'Active',        FALSE),
  ('inactive',      'Inactive',      TRUE),
  ('suspended',     'Suspended',     FALSE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_agreement_status (
  code        VARCHAR(20) PRIMARY KEY,
  label       VARCHAR(40) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO ref_agreement_status (code, label, is_terminal) VALUES
  ('draft',      'Draft',      FALSE),
  ('active',     'Active',     FALSE),
  ('expired',    'Expired',    TRUE),
  ('terminated', 'Terminated', TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_program_status (
  code        VARCHAR(20) PRIMARY KEY,
  label       VARCHAR(40) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO ref_program_status (code, label, is_terminal) VALUES
  ('draft',     'Draft',     FALSE),
  ('active',    'Active',    FALSE),
  ('paused',    'Paused',    FALSE),
  ('completed', 'Completed', TRUE),
  ('cancelled', 'Cancelled', TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_white_label_status (
  code       VARCHAR(20) PRIMARY KEY,
  label      VARCHAR(40) NOT NULL
);

INSERT INTO ref_white_label_status (code, label) VALUES
  ('draft',    'Draft'),
  ('active',   'Active'),
  ('inactive', 'Inactive')
ON CONFLICT (code) DO NOTHING;

-- ─── Branch ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS branch (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  parent_tenant_id UUID         REFERENCES tenant(id) ON DELETE SET NULL,
  name             VARCHAR(200) NOT NULL,
  type             VARCHAR(20)  NOT NULL REFERENCES ref_branch_type(code),
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending_setup' REFERENCES ref_branch_status(code),
  address_line1    VARCHAR(200) NOT NULL,
  address_line2    VARCHAR(200),
  city             VARCHAR(100) NOT NULL,
  state            VARCHAR(100) NOT NULL,
  country          CHAR(2)      NOT NULL,
  postal_code      VARCHAR(20)  NOT NULL,
  phone            VARCHAR(30),
  email            VARCHAR(254),
  timezone         VARCHAR(60)  NOT NULL,
  max_capacity     SMALLINT     NOT NULL CHECK (max_capacity >= 1),
  opened_at        TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_closed_only_when_inactive
    CHECK (closed_at IS NULL OR status IN ('inactive', 'suspended'))
);

CREATE INDEX IF NOT EXISTS idx_branch_tenant   ON branch(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_status   ON branch(status);
CREATE INDEX IF NOT EXISTS idx_branch_type     ON branch(type);
CREATE INDEX IF NOT EXISTS idx_branch_country  ON branch(country);

-- ─── Franchise Agreement ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS franchise_agreement (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  franchisee_tenant_id  UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  branch_id             UUID         NOT NULL REFERENCES branch(id) ON DELETE CASCADE,
  status                VARCHAR(20)  NOT NULL DEFAULT 'draft' REFERENCES ref_agreement_status(code),
  royalty_percent       NUMERIC(5,2) NOT NULL CHECK (royalty_percent >= 0 AND royalty_percent <= 100),
  setup_fee             INTEGER      NOT NULL DEFAULT 0 CHECK (setup_fee >= 0),  -- cents
  monthly_fee           INTEGER      NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0), -- cents
  currency              CHAR(3)      NOT NULL,
  start_date            DATE         NOT NULL,
  end_date              DATE         NOT NULL,
  signed_by_franchisor  VARCHAR(200),
  signed_by_franchisee  VARCHAR(200),
  signed_at             TIMESTAMPTZ,
  terminated_at         TIMESTAMPTZ,
  termination_reason    TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_end_after_start
    CHECK (end_date > start_date),
  CONSTRAINT chk_active_requires_signatures
    CHECK (status != 'active' OR (signed_by_franchisor IS NOT NULL AND signed_by_franchisee IS NOT NULL)),
  CONSTRAINT chk_terminated_requires_reason
    CHECK (status != 'terminated' OR termination_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_fa_tenant       ON franchise_agreement(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fa_franchisee   ON franchise_agreement(franchisee_tenant_id);
CREATE INDEX IF NOT EXISTS idx_fa_branch       ON franchise_agreement(branch_id);
CREATE INDEX IF NOT EXISTS idx_fa_status       ON franchise_agreement(status);

-- ─── Corporate Wellness Program ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS corporate_wellness_program (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  corporate_name    VARCHAR(200) NOT NULL,
  contact_name      VARCHAR(200) NOT NULL,
  contact_email     VARCHAR(254) NOT NULL,
  program_name      VARCHAR(200) NOT NULL,
  employee_count    INTEGER      NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  max_employees     INTEGER      NOT NULL CHECK (max_employees >= 1),
  price_per_employee INTEGER     NOT NULL DEFAULT 0 CHECK (price_per_employee >= 0), -- cents/month
  currency          CHAR(3)      NOT NULL,
  start_date        DATE         NOT NULL,
  end_date          DATE         NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'draft' REFERENCES ref_program_status(code),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cwp_end_after_start
    CHECK (end_date > start_date),
  CONSTRAINT chk_cwp_count_within_max
    CHECK (employee_count <= max_employees)
);

CREATE INDEX IF NOT EXISTS idx_cwp_tenant  ON corporate_wellness_program(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cwp_status  ON corporate_wellness_program(status);
CREATE INDEX IF NOT EXISTS idx_cwp_email   ON corporate_wellness_program(contact_email);

CREATE TABLE IF NOT EXISTS corporate_program_feature (
  program_id UUID NOT NULL REFERENCES corporate_wellness_program(id) ON DELETE CASCADE,
  feature    TEXT NOT NULL,
  PRIMARY KEY (program_id, feature)
);

-- ─── White-Label Configuration ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS white_label_config (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL UNIQUE REFERENCES tenant(id) ON DELETE CASCADE,
  brand_name        VARCHAR(200) NOT NULL,
  logo_url          TEXT,
  favicon_url       TEXT,
  primary_color     CHAR(7)      NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color   CHAR(7)      NOT NULL CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color      CHAR(7)      NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  custom_domain     VARCHAR(253),
  support_email     VARCHAR(254),
  privacy_policy_url TEXT,
  terms_url          TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'draft' REFERENCES ref_white_label_status(code),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_wl_active_requires_logo
    CHECK (status != 'active' OR logo_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_wl_status        ON white_label_config(status);
CREATE INDEX IF NOT EXISTS idx_wl_custom_domain ON white_label_config(custom_domain);

-- ─── Enterprise Audit Log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enterprise_audit (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  entity_type   VARCHAR(40) NOT NULL, -- 'branch' | 'franchise_agreement' | 'corporate_program' | 'white_label'
  entity_id     UUID        NOT NULL,
  action        VARCHAR(60) NOT NULL,
  actor_id      UUID,
  actor_email   VARCHAR(254),
  old_status    VARCHAR(20),
  new_status    VARCHAR(20),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ent_audit_tenant    ON enterprise_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ent_audit_entity    ON enterprise_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ent_audit_actor     ON enterprise_audit(actor_id);
CREATE INDEX IF NOT EXISTS idx_ent_audit_created   ON enterprise_audit(created_at DESC);

-- ─── Views ────────────────────────────────────────────────────────────────────

-- Active branches with franchise agreement summary
CREATE OR REPLACE VIEW v_active_branches AS
SELECT
  b.id,
  b.tenant_id,
  b.name,
  b.type,
  b.status,
  b.city,
  b.country,
  b.max_capacity,
  b.opened_at,
  fa.id            AS agreement_id,
  fa.royalty_percent,
  fa.monthly_fee,
  fa.currency,
  fa.end_date      AS agreement_end_date
FROM branch b
LEFT JOIN franchise_agreement fa
  ON fa.branch_id = b.id AND fa.status = 'active'
WHERE b.status = 'active';

-- Franchise summary per franchisor tenant
CREATE OR REPLACE VIEW v_franchise_summary AS
SELECT
  fa.tenant_id                           AS franchisor_tenant_id,
  COUNT(*)                               AS total_agreements,
  COUNT(*) FILTER (WHERE fa.status = 'active')     AS active_count,
  COUNT(*) FILTER (WHERE fa.status = 'terminated') AS terminated_count,
  COUNT(*) FILTER (WHERE fa.status = 'expired')    AS expired_count,
  COALESCE(SUM(fa.monthly_fee) FILTER (WHERE fa.status = 'active'), 0) AS total_monthly_fee_cents,
  COALESCE(SUM(ROUND(fa.monthly_fee * fa.royalty_percent / 100))
    FILTER (WHERE fa.status = 'active'), 0)         AS total_monthly_royalty_cents
FROM franchise_agreement fa
GROUP BY fa.tenant_id;

-- Corporate wellness program enrollment stats
CREATE OR REPLACE VIEW v_corporate_program_stats AS
SELECT
  p.id,
  p.tenant_id,
  p.corporate_name,
  p.program_name,
  p.status,
  p.employee_count,
  p.max_employees,
  ROUND((p.employee_count::NUMERIC / NULLIF(p.max_employees, 0)) * 100) AS utilization_pct,
  p.price_per_employee * p.employee_count                                AS monthly_revenue_cents,
  p.end_date
FROM corporate_wellness_program p;
