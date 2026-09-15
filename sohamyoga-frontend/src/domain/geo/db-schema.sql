-- GEO Visibility Engine, added 2026-09-14 -- backlog item #9. No real
-- AI-search-visibility API exists or is invoked here (no ChatGPT/
-- Perplexity/Google-AI-Overview scraping integration in this codebase,
-- confirmed via search before building). Per the roadmap's own explicit
-- caution ("never fabricate an AI ranking score"), this is real,
-- admin-entered observation only -- an admin actually types a real
-- query into a real AI answer engine, records whether/how the business
-- was mentioned. Same honest pattern as competitor pricing and brand
-- mentions elsewhere in this codebase.

CREATE TABLE IF NOT EXISTS geo_mention_observation (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  platform       VARCHAR(30)   NOT NULL CHECK (platform IN ('chatgpt','perplexity','google_ai_overview','claude','gemini','other')),
  query_text     TEXT          NOT NULL, -- the real query the admin actually typed
  was_mentioned  BOOLEAN       NOT NULL, -- real observed outcome
  excerpt        TEXT          NOT NULL DEFAULT '', -- what the AI actually said, if mentioned
  observed_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_mention_tenant ON geo_mention_observation (tenant_id, observed_at DESC);
