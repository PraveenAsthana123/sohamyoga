-- AI Brand Compliance Checker: banned_phrases/approved_phrases on brand_kit
-- were stored but never enforced against any published content (found live
-- 2026-09-01, from a ChatGPT platform-blueprint conversation naming this
-- exact gap). This adds real compliance tracking to content_variant, the
-- table CampaignAdaptationJob already writes AI-adapted copy into.

ALTER TABLE content_variant ADD COLUMN IF NOT EXISTS compliance_status TEXT NOT NULL DEFAULT 'not_checked'
  CHECK (compliance_status IN ('not_checked','pass','flagged'));
ALTER TABLE content_variant ADD COLUMN IF NOT EXISTS compliance_violations TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE content_variant ADD COLUMN IF NOT EXISTS compliance_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_content_variant_compliance ON content_variant (compliance_status);
