-- Email templates: genuinely missing everywhere in this codebase before now
-- (campaign_message.body was always freeform text, never reusable content).
-- Kept intentionally simple — name/subject/body with {{variable}} tokens,
-- draft/approved lifecycle — rather than a full drag-and-drop builder,
-- which nobody asked for a working proof of yet.
CREATE TABLE IF NOT EXISTS email_template (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  variables   TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_template_workspace ON email_template(workspace_id, status);

-- campaign_message can now reference the template it was rendered from —
-- nullable, since a message can still be freeform (existing behavior
-- unchanged, this is additive).
ALTER TABLE campaign_message ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_template(id) ON DELETE SET NULL;

-- Real lead capture for this portal. sohamyoga-frontend already has a much
-- more mature campaign_lead/lead-scoring system — this is deliberately a
-- smaller, real, working version scoped to market-research-portal's own
-- campaigns and attributed form links, not a duplicate of that machinery.
CREATE TABLE IF NOT EXISTS lead (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES campaign(id) ON DELETE SET NULL,
  form_link_id  UUID REFERENCES marketing_form_link(id) ON DELETE SET NULL,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  message       TEXT,
  source        TEXT NOT NULL DEFAULT 'form',
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
  score         INT CHECK (score BETWEEN 0 AND 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_lead_workspace ON lead(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_form_link ON lead(form_link_id);
