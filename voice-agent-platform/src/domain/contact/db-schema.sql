-- =============================================================================
-- Contact schema — the single source of truth for a person/lead a clinic's
-- voice agent (or staff) may call. Created directly via the admin CRUD API,
-- or indirectly by a public form submission (see src/domain/form).
-- =============================================================================

CREATE TYPE contact_status AS ENUM ('new', 'contacted', 'qualified', 'customer', 'do_not_call', 'archived');

CREATE TABLE contact (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT NOT NULL CHECK (full_name <> ''),
  email             TEXT,
  phone             TEXT,
  clinic_name       TEXT,          -- the clinic/account this contact belongs to
  preferred_language TEXT NOT NULL DEFAULT 'en',
  status            contact_status NOT NULL DEFAULT 'new',
  source            TEXT NOT NULL DEFAULT 'manual',   -- e.g. 'manual', 'form:<slug>', 'import'
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_contact_status ON contact(status);
CREATE INDEX idx_contact_created_at ON contact(created_at DESC);
CREATE INDEX idx_contact_email ON contact(email);
CREATE INDEX idx_contact_phone ON contact(phone);
