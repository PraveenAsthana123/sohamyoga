-- Hook Management: confirmed missing in this session's earlier gap analysis
-- (docs/advanced-management-feature-list-gap-analysis.md). Real, reusable
-- hook library with performance tracking — not fabricated view/CTR numbers,
-- those columns start real-NULL until actual publish/analytics data exists
-- (content_factory_metric already tracks per-variant performance once a
-- project has real published metrics; this table is the reusable hook text
-- itself, categorized and scored only once real data exists).
CREATE TABLE IF NOT EXISTS content_hook (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN (
                  'question','shock','curiosity','problem','contrarian','statistic',
                  'mistake','promise','transformation','story','challenge','fomo','comparison','before_after'
                )),
  topic         TEXT,
  platform      TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_hook_workspace ON content_hook(workspace_id, status, category);

-- A hook can be attached to a real content_factory_variant (linking the
-- reusable hook text to an actual produced video) so hook performance is
-- computed from content_factory_metric's real numbers, never a separate
-- fabricated tally.
ALTER TABLE content_factory_variant ADD COLUMN IF NOT EXISTS hook_id UUID REFERENCES content_hook(id) ON DELETE SET NULL;
