-- Real, minimal slice of "price tracking and control" (Topic Q): a
-- per-business monthly Vapi spend cap, checked against real cost_usd
-- already captured by the webhook receiver. NOT a market-price-tracking
-- system -- there is no external volatile price source for this product;
-- the only real "price" here is Vapi's own per-call cost, which this
-- app already measures.
ALTER TABLE business_customer ADD COLUMN IF NOT EXISTS monthly_cost_cap_usd NUMERIC(10, 2);
