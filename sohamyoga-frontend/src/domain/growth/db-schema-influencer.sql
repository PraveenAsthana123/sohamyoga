-- =============================================================================
-- Influencer Engine (Phase D of the growth-loop architecture).
--
-- Genuinely new domain — confirmed this session (Explore agent) that no
-- influencer/creator schema exists anywhere in this codebase; only
-- incidental references (e.g. 'influencer' as one ReferralType enum value
-- in the migration-052 referral domain). influencer_profile links to that
-- real referral domain via referral_code_id when a code has been issued,
-- so InfluencerValueJob can score from real referral attribution instead
-- of inventing reach/engagement numbers.
--
-- Deliberately NOT included in v1: a link from influencer_profile to
-- social_account/social_post. That would let InfluencerValueJob also score
-- content engagement, but social_post/social_post_analytics currently have
-- zero rows (no social account is connected via Postiz OAuth yet) and no
-- such link exists in the social schema today — adding one now would be
-- guessing at a shape rather than building on something real. Deferred
-- until a real connected-account link exists, same discipline as
-- advocacy_score deferring sentiment_log linkage.
-- =============================================================================

CREATE TABLE IF NOT EXISTS influencer_profile (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  handle            VARCHAR(120)  NOT NULL,
  platform          TEXT          NOT NULL REFERENCES ref_social_platform(platform),
  follower_count    INTEGER       NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  engagement_rate   NUMERIC(5,2),                     -- self-reported or manually recorded, percent
  tier              VARCHAR(20)   NOT NULL DEFAULT 'nano' CHECK (tier IN ('nano','micro','mid','macro','mega')),
  referral_code_id  UUID          REFERENCES referral_code(id),  -- set once a code is issued to this influencer
  status            VARCHAR(20)   NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','active','inactive')),
  notes             TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, handle, platform)
);

CREATE INDEX IF NOT EXISTS idx_influencer_profile_tenant ON influencer_profile (tenant_id, status);

CREATE TABLE IF NOT EXISTS influencer_collaboration (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  influencer_id   UUID          NOT NULL REFERENCES influencer_profile(id) ON DELETE CASCADE,
  campaign_name   VARCHAR(200)  NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'identified' CHECK (status IN
                    ('identified','contacted','negotiating','active','completed','declined')),
  deliverables      TEXT,
  compensation_type VARCHAR(30)  CHECK (compensation_type IN ('cash','free_class','membership','commission','product','none')),
  compensation_value NUMERIC(10,2),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencer_collab_influencer ON influencer_collaboration (influencer_id, status);

-- Recomputed by InfluencerValueJob — real referral attribution only.
CREATE TABLE IF NOT EXISTS influencer_value_score (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  influencer_id       UUID          NOT NULL REFERENCES influencer_profile(id) ON DELETE CASCADE,
  referral_count      INTEGER       NOT NULL DEFAULT 0,
  revenue_attributed  NUMERIC(12,2) NOT NULL DEFAULT 0,
  value_score         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  value_status        VARCHAR(20)   NOT NULL CHECK (value_status IN ('scored','insufficient_data')),
  ai_note             TEXT,
  computed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (influencer_id)
);
