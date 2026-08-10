-- Abandoned-cart recovery drafts. One row per stalled sales_order, generated
-- once (UNIQUE order_id) so the job never re-drafts the same cart. Draft-only
-- by design — matches the rest of this app's pattern (draft_reply, Quora
-- manual queue): Ollama writes the message, a human sends it.

-- No tenant_id: sales_order/order_item are tenant-agnostic in this schema
-- (unlike product_master/vendor/customer), so this table follows suit.
CREATE TABLE IF NOT EXISTS abandoned_cart_recovery (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID         NOT NULL UNIQUE REFERENCES sales_order(id) ON DELETE CASCADE,
  customer_email   VARCHAR(200) NOT NULL,
  cart_summary     TEXT         NOT NULL,   -- human-readable item list, for display without re-joining order_item
  cart_total       NUMERIC(10,2) NOT NULL,
  subject          VARCHAR(200) NOT NULL,
  message          TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','recovered','dismissed')),
  detected_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  sent_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cart_recovery_status ON abandoned_cart_recovery(status);
