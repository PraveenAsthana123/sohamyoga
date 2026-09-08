-- Retargeting / Remarketing Pixels (Migration 157, 2026-09-07)
-- Closes the "retargeting-pixels" module_registry gap: zero pixel of any
-- kind (fbq(, gtag('config', fbevents) existed anywhere in this codebase
-- before this change. Pixel IDs are NOT secrets (they are always visible in
-- public page source once fired), so this is a plain config table, not an
-- OpenBao-vaulted credential like platform_setup -- storing a public ad-
-- platform pixel ID in a secrets vault would be the wrong tool and would
-- wrongly couple this feature to OpenBao's uptime.
CREATE TABLE IF NOT EXISTS tracking_pixel_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('meta_pixel','ga4')),
  pixel_id    TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform)
);
