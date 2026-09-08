-- Exchange Management -- no exchange concept existed: a returned order could
-- only be refunded (money back), never swapped for a replacement item. Adds
-- an 'exchanged' terminal status and a self-referencing link to the
-- replacement order.
ALTER TABLE sales_order DROP CONSTRAINT IF EXISTS sales_order_status_check;
ALTER TABLE sales_order ADD CONSTRAINT sales_order_status_check
  CHECK (status IN ('draft','pending','confirmed','processing','partially_shipped','shipped','delivered','cancelled','refunded','returned','exchanged'));

ALTER TABLE sales_order ADD COLUMN IF NOT EXISTS exchange_for_order_id UUID REFERENCES sales_order(id);
CREATE INDEX IF NOT EXISTS idx_order_exchange_for ON sales_order(exchange_for_order_id) WHERE exchange_for_order_id IS NOT NULL;
