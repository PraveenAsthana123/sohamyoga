-- ============================================================
-- SOHAM YOGA PORTAL — eCOMMERCE ENGINE MASTER TABLES
-- Wave 9 — eCommerce Module
-- PostgreSQL 15 | MedusaJS (9003/9004) + ERPNext (8080) + Redis + Stripe
-- ============================================================

-- [1] CATEGORY — hierarchical product taxonomy
CREATE TABLE IF NOT EXISTS category (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  parent_id     UUID REFERENCES category(id),
  description   TEXT,
  image_url     TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  meta_title    VARCHAR(200),
  meta_description TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [2] PRODUCT MASTER — full catalog (physical, digital, service, workshop, retreat, course…)
CREATE TABLE IF NOT EXISTS product_master (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(200) NOT NULL,
  slug                  VARCHAR(200) NOT NULL UNIQUE,
  product_type          VARCHAR(20)  NOT NULL CHECK (product_type IN (
                          'physical','digital','service','subscription','bundle',
                          'workshop','retreat','course','gift_card','ayurvedic','book','membership')),
  status                VARCHAR(20)  NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','active','archived','out_of_stock')),
  description           TEXT,
  short_description     VARCHAR(500),
  base_price            NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  compare_at_price      NUMERIC(10,2),
  currency              CHAR(3)      NOT NULL DEFAULT 'CAD',
  sku                   VARCHAR(100) NOT NULL UNIQUE,
  track_inventory       BOOLEAN      NOT NULL DEFAULT true,
  stock                 INT          NOT NULL DEFAULT 0,
  low_stock_threshold   INT          NOT NULL DEFAULT 5,
  requires_shipping     BOOLEAN      NOT NULL DEFAULT true,
  weight                NUMERIC(8,3),
  weight_unit           VARCHAR(5)   CHECK (weight_unit IN ('kg','g','lb')),
  digital_url           TEXT,
  download_limit        INT,
  download_expiry_days  INT,
  taxable               BOOLEAN      NOT NULL DEFAULT true,
  tax_class             VARCHAR(20)  NOT NULL DEFAULT 'standard'
                          CHECK (tax_class IN ('standard','reduced','zero','exempt')),
  hsn_code              VARCHAR(20),  -- India GST HS/HSN code
  brand                 VARCHAR(100),
  vendor_id             UUID,
  teacher_id            UUID,
  duration_minutes      INT,
  max_participants      INT,
  is_giftable           BOOLEAN      NOT NULL DEFAULT false,
  is_subscription_product BOOLEAN    NOT NULL DEFAULT false,
  meta_title            VARCHAR(200),
  meta_description      TEXT,
  average_rating        NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count          INT          NOT NULL DEFAULT 0,
  categories            TEXT[]       DEFAULT '{}',
  tags                  TEXT[]       DEFAULT '{}',
  created_by            VARCHAR(100) NOT NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_type   ON product_master(product_type);
CREATE INDEX IF NOT EXISTS idx_product_status ON product_master(status);
CREATE INDEX IF NOT EXISTS idx_product_vendor ON product_master(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_search ON product_master USING gin(to_tsvector('english', name || ' ' || COALESCE(short_description,'')));

-- [3] PRODUCT VARIANT — size/color/format combinations per product
CREATE TABLE IF NOT EXISTS product_variant (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID         NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  sku                 VARCHAR(100) NOT NULL UNIQUE,
  name                VARCHAR(200) NOT NULL,
  attributes          JSONB        NOT NULL DEFAULT '{}',  -- {size:"S", color:"Blue"}
  price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  compare_at_price    NUMERIC(10,2),
  stock               INT          NOT NULL DEFAULT 0,
  low_stock_threshold INT          NOT NULL DEFAULT 3,
  weight              NUMERIC(8,3),
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  sort_order          INT          NOT NULL DEFAULT 0
);

-- [4] PRODUCT IMAGE
CREATE TABLE IF NOT EXISTS product_image (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    VARCHAR(200),
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT     NOT NULL DEFAULT 0
);

-- [5] WAREHOUSE — multi-location stock management
CREATE TABLE IF NOT EXISTS warehouse (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  address     JSONB        NOT NULL DEFAULT '{}',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  is_default  BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [6] INVENTORY — per-product-per-warehouse stock levels
CREATE TABLE IF NOT EXISTS inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID         NOT NULL REFERENCES product_master(id),
  variant_id          UUID         REFERENCES product_variant(id),
  warehouse_id        UUID         NOT NULL REFERENCES warehouse(id),
  sku                 VARCHAR(100) NOT NULL,
  quantity            INT          NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity   INT          NOT NULL DEFAULT 0,
  reorder_point       INT          NOT NULL DEFAULT 10,
  reorder_quantity    INT          NOT NULL DEFAULT 100,
  batch_number        VARCHAR(100),
  expiry_date         DATE,
  serial_number       VARCHAR(100),
  location            VARCHAR(50),  -- bin location e.g., "A-12-3"
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_id, warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_product   ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(product_id) WHERE quantity <= reorder_point;

-- [7] STOCK MOVEMENT — immutable inventory audit log
CREATE TABLE IF NOT EXISTS stock_movement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    UUID        NOT NULL REFERENCES inventory(id),
  movement_type   VARCHAR(20) NOT NULL CHECK (movement_type IN (
                    'receipt','sale','reservation','release','adjustment',
                    'transfer_out','transfer_in','return','expired','damaged')),
  quantity        INT         NOT NULL,  -- positive=in, negative=out
  reference_id    VARCHAR(100),
  reason          TEXT,
  warehouse_id    UUID        NOT NULL,
  performed_by    VARCHAR(100) NOT NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_number    VARCHAR(100),
  serial_number   VARCHAR(100)
);

-- [8] SUPPLIER — product suppliers for purchase orders
CREATE TABLE IF NOT EXISTS supplier (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  address       JSONB        NOT NULL DEFAULT '{}',
  payment_terms INT          NOT NULL DEFAULT 30,  -- days
  currency      CHAR(3)      NOT NULL DEFAULT 'CAD',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [9] PURCHASE ORDER — supplier replenishment orders
CREATE TABLE IF NOT EXISTS purchase_order (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number       VARCHAR(50)  NOT NULL UNIQUE,
  supplier_id     UUID         NOT NULL REFERENCES supplier(id),
  warehouse_id    UUID         NOT NULL REFERENCES warehouse(id),
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','acknowledged','partially_received','received','cancelled')),
  currency        CHAR(3)      NOT NULL DEFAULT 'CAD',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  expected_date   DATE,
  received_date   DATE,
  notes           TEXT,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [10] SALES ORDER — customer orders
CREATE TABLE IF NOT EXISTS sales_order (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          VARCHAR(50)  NOT NULL UNIQUE,
  customer_id           VARCHAR(100),
  customer_email        VARCHAR(200) NOT NULL,
  status                VARCHAR(30)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('draft','pending','confirmed','processing',
                            'partially_shipped','shipped','delivered','cancelled','refunded','returned')),
  payment_status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending','paid','partially_paid','failed','refunded')),
  fulfillment_status    VARCHAR(20)  NOT NULL DEFAULT 'unfulfilled'
                          CHECK (fulfillment_status IN ('unfulfilled','partial','fulfilled','returned')),
  currency              CHAR(3)      NOT NULL DEFAULT 'CAD',
  subtotal              NUMERIC(10,2) NOT NULL,
  discount_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code           VARCHAR(50),
  coupon_discount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  gift_card_code        VARCHAR(50),
  gift_card_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  wallet_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  reward_points_used    INT          NOT NULL DEFAULT 0,
  reward_points_value   NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(10,2) NOT NULL,
  shipping_address      JSONB,
  billing_address       JSONB,
  tracking_number       VARCHAR(100),
  tracking_url          TEXT,
  notes                 TEXT,
  internal_notes        TEXT,
  cancel_reason         TEXT,
  refund_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  refund_reason         TEXT,
  invoice_number        VARCHAR(50),
  metadata              JSONB        NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_customer ON sales_order(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_status   ON sales_order(status);
CREATE INDEX IF NOT EXISTS idx_order_created  ON sales_order(created_at DESC);

-- [11] ORDER ITEM — line items per order
CREATE TABLE IF NOT EXISTS order_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID         NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  product_id      VARCHAR(100) NOT NULL,
  product_name    VARCHAR(200) NOT NULL,
  product_type    VARCHAR(20)  NOT NULL,
  variant_id      VARCHAR(100),
  variant_name    VARCHAR(200),
  sku             VARCHAR(100) NOT NULL,
  quantity        INT          NOT NULL CHECK (quantity >= 1),
  unit_price      NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL,
  is_digital      BOOLEAN      NOT NULL DEFAULT false,
  download_url    TEXT,
  teacher_id      VARCHAR(100),
  vendor_id       VARCHAR(100)
);

-- [12] SHIPMENT — order fulfillment tracking
CREATE TABLE IF NOT EXISTS shipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID         NOT NULL REFERENCES sales_order(id),
  tracking_number VARCHAR(100),
  carrier         VARCHAR(100),
  tracking_url    TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','packed','shipped','delivered','returned')),
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [13] PAYMENT — payment records per order
CREATE TABLE IF NOT EXISTS payment (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID         NOT NULL REFERENCES sales_order(id),
  payment_method      VARCHAR(30)  NOT NULL CHECK (payment_method IN (
                        'stripe','paypal','square','apple_pay','google_pay',
                        'bank_transfer','wallet','reward_points','gift_card','partial')),
  amount              NUMERIC(10,2) NOT NULL,
  currency            CHAR(3)      NOT NULL DEFAULT 'CAD',
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','succeeded','failed','refunded')),
  provider_ref        VARCHAR(200), -- Stripe payment_intent_id, PayPal order_id, etc.
  refunded_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  gateway_response    JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [14] WALLET — customer stored-value wallet
CREATE TABLE IF NOT EXISTS wallet (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   VARCHAR(100) NOT NULL UNIQUE,
  balance       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency      CHAR(3)      NOT NULL DEFAULT 'CAD',
  reward_points INT          NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID         NOT NULL REFERENCES wallet(id),
  type            VARCHAR(20)  NOT NULL CHECK (type IN ('credit','debit','expiry','refund')),
  amount          NUMERIC(10,2) NOT NULL,
  points_delta    INT          NOT NULL DEFAULT 0,
  reference_id    VARCHAR(100),
  description     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [15] VENDOR — marketplace vendors, teacher stores, affiliates
CREATE TABLE IF NOT EXISTS vendor (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(200) NOT NULL,
  slug                  VARCHAR(200) NOT NULL UNIQUE,
  vendor_type           VARCHAR(20)  NOT NULL CHECK (vendor_type IN (
                          'teacher','partner','brand','affiliate','independent')),
  status                VARCHAR(20)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','suspended','deactivated')),
  email                 VARCHAR(200) NOT NULL,
  phone                 VARCHAR(50),
  commission_type       VARCHAR(20)  NOT NULL CHECK (commission_type IN ('percentage','fixed','tiered')),
  commission_rate       NUMERIC(6,2) NOT NULL DEFAULT 0,
  commission_tiers      JSONB,
  bank_account          VARCHAR(100),
  ifsc_code             VARCHAR(20),
  paypal_email          VARCHAR(200),
  settlement_frequency  VARCHAR(10)  NOT NULL DEFAULT 'monthly'
                          CHECK (settlement_frequency IN ('weekly','biweekly','monthly')),
  total_sales           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_commission_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
  suspend_reason        TEXT,
  metadata              JSONB        NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- [16] COMMISSION & SETTLEMENT
CREATE TABLE IF NOT EXISTS commission (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID         NOT NULL REFERENCES vendor(id),
  order_id        UUID         NOT NULL REFERENCES sales_order(id),
  order_item_id   UUID         REFERENCES order_item(id),
  gross_amount    NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(6,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  net_amount      NUMERIC(10,2) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','settled','failed')),
  settled_at      TIMESTAMPTZ,
  payment_reference VARCHAR(100),
  period          VARCHAR(7)   NOT NULL,  -- "2026-08"
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_product_catalog AS
SELECT
  p.id, p.name, p.slug, p.product_type, p.status,
  p.base_price, p.currency, p.sku, p.stock, p.average_rating, p.review_count,
  p.vendor_id, p.teacher_id,
  COUNT(DISTINCT pv.id) AS variant_count,
  p.categories, p.tags
FROM product_master p
LEFT JOIN product_variant pv ON pv.product_id = p.id AND pv.is_active = true
WHERE p.status = 'active'
GROUP BY p.id;

CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
  DATE_TRUNC('month', o.created_at) AS month,
  o.currency,
  COUNT(o.id)         AS order_count,
  SUM(o.total)        AS revenue,
  SUM(o.discount_amount + o.coupon_discount + o.gift_card_amount + o.wallet_amount) AS total_discounts,
  SUM(o.refund_amount) AS refunds,
  SUM(o.tax_amount)   AS tax_collected
FROM sales_order o
WHERE o.status NOT IN ('cancelled', 'draft')
GROUP BY DATE_TRUNC('month', o.created_at), o.currency
ORDER BY month DESC;

CREATE OR REPLACE VIEW v_vendor_performance AS
SELECT
  v.name AS vendor_name, v.vendor_type, v.status,
  v.total_sales, v.total_commission_paid, v.pending_balance,
  COUNT(c.id) AS order_count,
  AVG(c.commission_rate) AS avg_commission_rate
FROM vendor v
LEFT JOIN commission c ON c.vendor_id = v.id AND c.status = 'settled'
GROUP BY v.id;

-- ============================================================
-- INTEGRATION REFERENCE
-- ============================================================
-- MedusaJS (9003/9004): product_master → Medusa products/variants; sales_order → Medusa cart/order
-- ERPNext  (8080):       sales_order → Sales Invoice; payment → Payment Entry; inventory → Item/Warehouse
-- OfferKit (3050):       coupon_code validation at checkout; coupon_discount field sync
-- Stripe:                payment.provider_ref = stripe_payment_intent_id; webhook → payment.status
-- Cal.com  (3100):       workshop/retreat products → Cal.com event slots; booking confirmed → order_item
-- Redis    (6379):       cart TTL (guest carts 24h); inventory reservation locks (TTL 15min)
-- PostHog:               product_viewed, add_to_cart, checkout_started, order_placed, refund_requested
-- Novu     (4001):       order_confirmed, shipment_dispatched, delivery_confirmed, refund_processed
-- Metabase (3001):       v_sales_summary, v_vendor_performance dashboards
