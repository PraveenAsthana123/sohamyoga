-- Customer domain DB schema
-- Customer = a paying user (student after enrollment).
-- Financial data mirrors ERPNext; support data mirrors Chatwoot.
-- Loyalty, invoice mirror, and support ticket records live here for quick portal reads.
-- All tables include tenant_id for multi-tenancy.

-- ── Reference tables ──────────────────────────────────────────────────────────

CREATE TABLE ref_customer_tier (
  code             VARCHAR(16) PRIMARY KEY,
  label            VARCHAR(64) NOT NULL,
  min_spend_cad    NUMERIC(10,2) NOT NULL DEFAULT 0,  -- annual spend threshold
  discount_pct     SMALLINT NOT NULL DEFAULT 0,
  monthly_bonus_pts SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO ref_customer_tier (code, label, min_spend_cad, discount_pct, monthly_bonus_pts) VALUES
  ('standard',  'Standard',  0,       0,  0),
  ('silver',    'Silver',    500,     5,  50),
  ('gold',      'Gold',      1200,    10, 100),
  ('platinum',  'Platinum',  2500,    15, 200),
  ('corporate', 'Corporate', 0,       12, 0);

CREATE TABLE ref_invoice_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_invoice_status (code) VALUES
  ('draft'), ('submitted'), ('paid'), ('overdue'), ('cancelled');

CREATE TABLE ref_ticket_category (
  code  VARCHAR(32) PRIMARY KEY
);
INSERT INTO ref_ticket_category (code) VALUES
  ('billing'), ('class_change'), ('complaint'), ('health_concern'), ('general'), ('technical');

CREATE TABLE ref_ticket_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_ticket_status (code) VALUES
  ('open'), ('in_progress'), ('pending_customer'), ('resolved'), ('closed');

-- ── Customer profile ──────────────────────────────────────────────────────────

CREATE TABLE customer (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  user_id               UUID          NOT NULL UNIQUE,   -- Keycloak identity link
  student_id            UUID          UNIQUE,             -- links to student table once enrolled
  -- External system links
  erpnext_customer_id   VARCHAR(64)   UNIQUE,
  chatwoot_contact_id   VARCHAR(64)   UNIQUE,
  frappe_crm_lead_id    VARCHAR(64),                     -- if originally a CRM lead
  -- Profile
  display_name          VARCHAR(256)  NOT NULL,
  email                 VARCHAR(256)  NOT NULL UNIQUE,
  phone                 VARCHAR(32),
  preferred_currency    CHAR(3)       NOT NULL DEFAULT 'CAD',
  -- Tier & loyalty
  tier                  VARCHAR(16)   NOT NULL DEFAULT 'standard' REFERENCES ref_customer_tier(code),
  loyalty_points        INTEGER       NOT NULL DEFAULT 0,
  lifetime_spend_cad    NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Marketing consent
  email_opt_in          BOOLEAN       NOT NULL DEFAULT FALSE,
  sms_opt_in            BOOLEAN       NOT NULL DEFAULT FALSE,
  consent_updated_at    TIMESTAMPTZ,
  -- Timestamps
  first_purchase_at     TIMESTAMPTZ,
  last_purchase_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_customer_loyalty CHECK (loyalty_points >= 0),
  CONSTRAINT chk_customer_spend   CHECK (lifetime_spend_cad >= 0)
);

CREATE INDEX idx_customer_tenant  ON customer (tenant_id, tier);
CREATE INDEX idx_customer_erpnext ON customer (erpnext_customer_id) WHERE erpnext_customer_id IS NOT NULL;
CREATE INDEX idx_customer_chatwoot ON customer (chatwoot_contact_id) WHERE chatwoot_contact_id IS NOT NULL;

-- ── Loyalty ledger ────────────────────────────────────────────────────────────

CREATE TABLE loyalty_transaction (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  customer_id    UUID          NOT NULL REFERENCES customer(id),
  amount         INTEGER       NOT NULL,        -- positive = earn, negative = redeem
  balance_after  INTEGER       NOT NULL,
  reason         VARCHAR(128)  NOT NULL,         -- 'class_attended', 'referral_bonus', 'tier_upgrade', 'redemption'
  reference_id   UUID,
  reference_type VARCHAR(64),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_loyalty_nonzero CHECK (amount <> 0),
  CONSTRAINT chk_loyalty_nonneg  CHECK (balance_after >= 0)
);

CREATE INDEX idx_loyalty_customer ON loyalty_transaction (customer_id, created_at DESC);

-- ── Invoice mirror (read copy from ERPNext) ───────────────────────────────────

CREATE TABLE invoice_mirror (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  customer_id         UUID          NOT NULL REFERENCES customer(id),
  erpnext_invoice_id  VARCHAR(64)   NOT NULL UNIQUE,
  invoice_number      VARCHAR(64)   NOT NULL,
  status              VARCHAR(16)   NOT NULL DEFAULT 'draft' REFERENCES ref_invoice_status(code),
  amount_cad          NUMERIC(10,2) NOT NULL,
  tax_cad             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cad           NUMERIC(10,2) NOT NULL,
  description         TEXT,
  due_date            DATE,
  paid_at             TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),   -- last sync from ERPNext
  CONSTRAINT chk_inv_amount CHECK (amount_cad >= 0),
  CONSTRAINT chk_inv_total  CHECK (total_cad >= 0)
);

CREATE INDEX idx_invoice_customer ON invoice_mirror (customer_id, status, due_date);
CREATE INDEX idx_invoice_overdue  ON invoice_mirror (tenant_id, status, due_date)
  WHERE status IN ('submitted', 'overdue');

-- ── Support ticket (mirror of Chatwoot conversations) ────────────────────────

CREATE TABLE support_ticket (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL,
  customer_id           UUID         NOT NULL REFERENCES customer(id),
  chatwoot_conversation_id VARCHAR(64) UNIQUE,
  subject               VARCHAR(512) NOT NULL,
  category              VARCHAR(32)  NOT NULL REFERENCES ref_ticket_category(code),
  priority              VARCHAR(16)  NOT NULL DEFAULT 'medium',
  status                VARCHAR(32)  NOT NULL DEFAULT 'open' REFERENCES ref_ticket_status(code),
  assigned_agent_id     UUID,                    -- Chatwoot agent user_id
  first_response_at     TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  csat_score            SMALLINT,                -- 1-5 from post-resolution survey
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ticket_priority CHECK (priority IN ('low','medium','high','urgent')),
  CONSTRAINT chk_ticket_csat     CHECK (csat_score IS NULL OR csat_score BETWEEN 1 AND 5)
);

CREATE INDEX idx_ticket_customer ON support_ticket (customer_id, status, created_at DESC);
CREATE INDEX idx_ticket_open     ON support_ticket (tenant_id, status, priority)
  WHERE status IN ('open','in_progress','pending_customer');

-- ── Address book ─────────────────────────────────────────────────────────────

CREATE TABLE customer_address (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID          NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  tenant_id   UUID          NOT NULL,
  label       VARCHAR(64)   NOT NULL DEFAULT 'Home',
  line1       VARCHAR(256)  NOT NULL,
  line2       VARCHAR(256),
  city        VARCHAR(128)  NOT NULL,
  state       VARCHAR(128),
  postal_code VARCHAR(16),
  country     CHAR(2)       NOT NULL DEFAULT 'CA',
  is_default  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_address_customer ON customer_address (customer_id);

-- ── CRM note (internal staff notes per customer) ─────────────────────────────

CREATE TABLE customer_note (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL,
  customer_id UUID         NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  author_id   UUID         NOT NULL,  -- staff user_id
  content     TEXT         NOT NULL,
  is_pinned   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_note_customer ON customer_note (customer_id, is_pinned DESC, created_at DESC);

-- ── Views ─────────────────────────────────────────────────────────────────────

-- Customer 360 summary for portal dashboard and CRM
CREATE VIEW v_customer_360 AS
  SELECT
    c.id                AS customer_id,
    c.tenant_id,
    c.display_name,
    c.email,
    c.tier,
    c.loyalty_points,
    c.lifetime_spend_cad,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid')     AS paid_invoice_count,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'overdue')  AS overdue_invoice_count,
    COALESCE(SUM(i.total_cad) FILTER (WHERE i.status = 'overdue'), 0) AS outstanding_cad,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('resolved','closed'))  AS open_ticket_count,
    MAX(t.created_at)   AS last_ticket_at
  FROM customer c
  LEFT JOIN invoice_mirror  i ON i.customer_id = c.id
  LEFT JOIN support_ticket  t ON t.customer_id = c.id
  GROUP BY c.id, c.tenant_id, c.display_name, c.email, c.tier, c.loyalty_points, c.lifetime_spend_cad;

-- Overdue invoices for collections follow-up
CREATE VIEW v_overdue_invoices AS
  SELECT
    im.*,
    c.display_name,
    c.email,
    c.phone,
    (CURRENT_DATE - im.due_date) AS days_overdue
  FROM invoice_mirror im
  JOIN customer c ON c.id = im.customer_id
  WHERE im.status IN ('submitted', 'overdue')
    AND im.due_date < CURRENT_DATE
  ORDER BY days_overdue DESC;
