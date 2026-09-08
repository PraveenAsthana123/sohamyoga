-- Real per-platform bio layer, derived from (never independent of) the one
-- real social_brand_profile row -- keeps 35 platforms speaking with one
-- consistent brand voice instead of 35 independently-drifting identities.
-- social_brand_profile itself existed since the original provisioning
-- migration but had zero writers anywhere in the codebase; BrandProfileDraftJob
-- is the first.
CREATE TABLE IF NOT EXISTS social_platform_bio (
  platform            TEXT PRIMARY KEY REFERENCES ref_social_platform(platform),
  source_profile_id   UUID NOT NULL REFERENCES social_brand_profile(id) ON DELETE CASCADE,
  bio_tier            TEXT NOT NULL CHECK (bio_tier IN ('bio_80', 'bio_150', 'bio_255')),
  bio_text            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
