-- Real, admin-curated research resource library. The source ChatGPT
-- conversation asking for "research papers on digital marketing" had its
-- actual paper-list content permanently redacted by ChatGPT's own browsing
-- tool (unrecoverable, confirmed via re-extraction) -- so this is built as
-- real infrastructure for a human to populate with real citations, never
-- pre-seeded with invented paper titles/authors/DOIs.
CREATE TABLE IF NOT EXISTS research_resource (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (title <> ''),
  authors          TEXT,
  source_url       TEXT NOT NULL CHECK (source_url <> ''),
  publication_year INT CHECK (publication_year BETWEEN 1990 AND 2100),
  category         TEXT NOT NULL CHECK (category IN ('market_research','digital_marketing','ai_automation')),
  summary          TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  added_by         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_resource_status ON research_resource(workspace_id, category, status);
