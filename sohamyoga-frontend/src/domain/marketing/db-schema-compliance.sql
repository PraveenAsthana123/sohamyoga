-- Content compliance checking. Each generated asset gets a second Ollama
-- pass that checks the copy against the brief's own offer/CTA text — flags
-- invented pricing, certifications, guarantees, or unverified health/medical
-- claims (yoga/wellness marketing is subject to advertising-standards
-- scrutiny on health claims). Runs at generation time, before admin review,
-- so the flag is visible in the same review panel that already handles
-- approve/reject.

ALTER TABLE generated_marketing_asset
  ADD COLUMN IF NOT EXISTS compliance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (compliance_status IN ('pending', 'pass', 'flagged'));
ALTER TABLE generated_marketing_asset ADD COLUMN IF NOT EXISTS compliance_notes TEXT;
ALTER TABLE generated_marketing_asset ADD COLUMN IF NOT EXISTS compliance_checked_at TIMESTAMPTZ;
