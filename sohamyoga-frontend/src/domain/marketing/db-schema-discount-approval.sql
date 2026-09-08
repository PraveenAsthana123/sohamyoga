-- Discount Approval -- proposal had a real amount but no way to record a
-- discount off list price or gate large discounts behind a second admin's
-- approval. list_price is captured at proposal-creation time so
-- discount_percent is always derived from a real number, never guessed
-- after the fact.
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS list_price NUMERIC(10,2);
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS approved_by VARCHAR(120);
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
