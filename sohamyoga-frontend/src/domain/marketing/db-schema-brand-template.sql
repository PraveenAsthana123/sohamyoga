-- Brand Template Management -- no reusable-content-template concept existed
-- anywhere: content_variant rows were always authored per-campaign from
-- scratch or AI-generated, with no library of reusable starting points tied
-- to a brand kit's voice/phrases.
CREATE TABLE IF NOT EXISTS brand_template (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  brand_kit_id   UUID REFERENCES brand_kit(id) ON DELETE SET NULL,
  name           TEXT NOT NULL CHECK (name <> ''),
  template_type  TEXT NOT NULL CHECK (template_type IN ('social_post', 'email', 'ad_copy', 'sms')),
  platform       TEXT,
  body_template  TEXT NOT NULL CHECK (body_template <> ''),
  usage_count    INT NOT NULL DEFAULT 0,
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_template_tenant ON brand_template(tenant_id, template_type);
