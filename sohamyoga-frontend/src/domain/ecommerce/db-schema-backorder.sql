-- Backorder Management -- inventory.reserve() rejected any request exceeding
-- available stock outright (confirmed via PATCH /api/ecommerce/inventory/[id]
-- built earlier this session). Real backorder support needs an explicit
-- per-SKU opt-in, not a silent oversell.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS allow_backorder BOOLEAN NOT NULL DEFAULT false;
