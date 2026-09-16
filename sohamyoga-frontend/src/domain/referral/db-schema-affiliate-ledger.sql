-- Separate referral rewards from the marketplace's vendor/platform commission.
CREATE TABLE IF NOT EXISTS affiliate_policy (
 vendor_id uuid PRIMARY KEY REFERENCES vendor(id),
 rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS affiliate_conversion (
 order_id uuid PRIMARY KEY REFERENCES sales_order(id),
 vendor_id uuid NOT NULL REFERENCES vendor(id),
 referral_code_id uuid NOT NULL REFERENCES referral_code(id),
 click_id uuid NOT NULL REFERENCES referral_click(id),
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 basis numeric(10,2) NOT NULL CHECK(basis >= 0),
 currency char(3) NOT NULL,
 earned numeric(10,2) NOT NULL DEFAULT 0 CHECK(earned >= 0),
 reversed numeric(10,2) NOT NULL DEFAULT 0 CHECK(reversed >= 0 AND reversed <= earned),
 paid numeric(10,2) NOT NULL DEFAULT 0 CHECK(paid >= 0 AND paid <= earned),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS affiliate_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES affiliate_conversion(order_id),
 kind text NOT NULL CHECK(kind IN ('earned','reversal','payout')),
 amount numeric(10,2) NOT NULL CHECK(amount > 0),
 reference text,
 actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id, kind, reference)
);
CREATE INDEX IF NOT EXISTS affiliate_conversion_vendor ON affiliate_conversion(vendor_id);
