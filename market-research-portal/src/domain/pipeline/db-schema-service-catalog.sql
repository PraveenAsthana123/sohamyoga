-- Real, browsable service catalog for the customer-facing side of this
-- portal (Market Research + Digital Marketing services). Deliberately
-- browse + inquire only, no checkout/payment: no payment gateway credentials
-- exist anywhere in this codebase (confirmed via this session's audits), so
-- a "Buy Now" button would either fake a charge or silently do nothing —
-- both violate this session's no-fabrication discipline. Inquiries reuse
-- the existing real lead-capture path rather than inventing a parallel one.
CREATE TABLE IF NOT EXISTS service_catalog_item (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('market_research','digital_marketing')),
  name         TEXT NOT NULL CHECK (name <> ''),
  description  TEXT NOT NULL DEFAULT '',
  price_note   TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_status ON service_catalog_item(workspace_id, category, status);

-- Ties a lead to the specific service it inquired about, nullable since
-- most existing leads have no service association.
ALTER TABLE lead ADD COLUMN IF NOT EXISTS service_item_id UUID REFERENCES service_catalog_item(id) ON DELETE SET NULL;

-- One real form_link so catalog inquiries flow through the existing,
-- already-real /api/leads/capture path instead of a parallel mechanism.
INSERT INTO marketing_form_link (workspace_id, name, slug, destination_url, status)
SELECT id, 'Service Catalog Inquiry', 'service-catalog', '/services', 'active'
FROM marketing_workspace ORDER BY created_at LIMIT 1
ON CONFLICT (slug) DO NOTHING;
