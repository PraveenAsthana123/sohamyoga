-- =============================================================================
-- CTA (Call-to-Action) Management Schema — Module 9 of the 25-item marketing
-- management list. Was previously "1 of 13" real: a CTA existed only as a
-- label+url field embedded in Banner, with no independent registry, redirect
-- service, or analytics. This is the missing central registry.
-- =============================================================================

CREATE TYPE cta_type AS ENUM ('form', 'booking', 'call', 'whatsapp', 'link', 'download', 'subscribe', 'share', 'custom');
CREATE TYPE cta_placement AS ENUM ('hero', 'footer', 'sidebar', 'inline', 'sticky', 'popup', 'email', 'other');
CREATE TYPE cta_risk AS ENUM ('low', 'medium', 'high');
CREATE TYPE cta_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE cta_check_status AS ENUM ('unknown', 'ok', 'broken');

CREATE TABLE cta (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  label               TEXT          NOT NULL CHECK (label <> ''),
  type                cta_type      NOT NULL,
  destination_url     TEXT          NOT NULL,
  tracking_slug       TEXT          NOT NULL,
  placement           cta_placement NOT NULL DEFAULT 'other',
  risk_classification cta_risk      NOT NULL DEFAULT 'low',
  status              cta_status    NOT NULL DEFAULT 'draft',
  click_count         INTEGER       NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  last_checked_at     TIMESTAMPTZ,
  last_check_status   cta_check_status NOT NULL DEFAULT 'unknown',
  fallback_url        TEXT,
  created_by          TEXT          NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tracking_slug)
);

CREATE INDEX idx_cta_tenant ON cta(tenant_id);
CREATE INDEX idx_cta_status ON cta(status);

-- Placement-level click analytics (Phase 1's own "placement-level analytics" ask).
CREATE TABLE cta_click_event (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cta_id       UUID        NOT NULL REFERENCES cta(id) ON DELETE CASCADE,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer     TEXT,
  user_agent   TEXT
);

CREATE INDEX idx_cta_click_cta ON cta_click_event(cta_id, occurred_at DESC);
