-- =============================================================================
-- Business customer auth + profile schema. A "business customer" is a
-- business (e.g. a yoga studio or clinic) self-serving on this platform:
-- their own login, separate from admin_user, with real business-context
-- fields (services/pricing/hours/holidays) that ground the call scripts and
-- Vapi assistant content used for THEIR outbound calls -- never fabricated,
-- always sourced from what the business itself entered. Mirrors admin
-- auth's real scrypt+opaque-session pattern (src/lib/auth.ts) exactly.
-- =============================================================================

CREATE TABLE business_customer (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  business_name        TEXT NOT NULL CHECK (business_name <> ''),
  service_type         clinic_service_type NOT NULL,
  services_description TEXT NOT NULL DEFAULT '',  -- what they offer, in their own words
  pricing_info         TEXT NOT NULL DEFAULT '',  -- cost/pricing, in their own words
  business_hours       TEXT NOT NULL DEFAULT '',  -- real operating hours
  holidays_closures    TEXT NOT NULL DEFAULT '',  -- real holiday/closure schedule
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_customer_session (
  token               TEXT PRIMARY KEY,
  business_customer_id UUID NOT NULL REFERENCES business_customer(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_business_customer_session_customer ON business_customer_session(business_customer_id);
CREATE INDEX idx_business_customer_session_expires ON business_customer_session(expires_at);

-- Contact ownership -- NULL means house/admin-owned (existing behavior,
-- unchanged); a real business_customer_id scopes a contact to exactly one
-- business, so each business only ever sees and calls their own uploaded
-- contacts, never another business's list.
ALTER TABLE contact ADD COLUMN IF NOT EXISTS owner_customer_id UUID REFERENCES business_customer(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_contact_owner ON contact(owner_customer_id);

-- Same ownership model for call scripts -- a business customer manages
-- their own scenario content (sections), scoped to their own scripts only.
-- NULL stays house/admin-owned (the 12 scripts already built this session).
-- Vapi technical config (model/voice/transcriber) and the actual sync
-- trigger remain admin-only, per explicit requirement -- business users get
-- content only, never provider/API-level control.
ALTER TABLE call_script ADD COLUMN IF NOT EXISTS owner_customer_id UUID REFERENCES business_customer(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_call_script_owner ON call_script(owner_customer_id);
