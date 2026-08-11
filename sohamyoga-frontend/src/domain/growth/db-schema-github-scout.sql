-- =============================================================================
-- GitHub Repo Scout (answers the explicit request "assign job to ollama to
-- search on github" for open-source reuse candidates relevant to the
-- growth-loop build — referral/affiliate tracking, influencer platforms,
-- viral/trend detection, and social automation via n8n).
--
-- Seeded below with the user's own two researched shortlists
-- (source='user_provided') so GitHubRepoScoutJob's own searches are
-- additive, not a rediscovery of what the user already found. Seed rows
-- intentionally do NOT include stars/description/last_pushed_at — those
-- would have to be invented without a real GitHub API call. The job
-- enriches every row (seeded or discovered) with real metadata from the
-- GitHub API on its first pass; relevance_note for seed rows is the user's
-- own stated reason, verbatim, not a model-generated claim.
-- =============================================================================

CREATE TABLE IF NOT EXISTS github_scout_candidate (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  full_name        VARCHAR(200)  NOT NULL,   -- "owner/repo"
  url              TEXT          NOT NULL,
  stars            INTEGER,                  -- NULL until enriched from the real GitHub API
  description      TEXT,
  last_pushed_at   TIMESTAMPTZ,
  matched_query     TEXT,                     -- NULL for user_provided rows
  source           VARCHAR(20)   NOT NULL CHECK (source IN ('user_provided','ollama_search')),
  relevance_note   TEXT,
  enriched_at      TIMESTAMPTZ,
  discovered_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, full_name)
);

CREATE INDEX IF NOT EXISTS idx_github_scout_tenant ON github_scout_candidate (tenant_id, source);

INSERT INTO github_scout_candidate (tenant_id, full_name, url, source, relevance_note)
SELECT t.id, v.full_name, v.url, 'user_provided', v.note
FROM tenant t, (VALUES
  ('n8n-io/n8n',                    'https://github.com/n8n-io/n8n',                    'Orchestration core — the workflow engine every n8n template below runs on.'),
  ('Ahmad-code077/n8n-automations', 'https://github.com/Ahmad-code077/n8n-automations', 'Facebook/Instagram workflows.'),
  ('workflowsdiy/n8n-workflows',    'https://github.com/workflowsdiy/n8n-workflows',    'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('Jharilela/n8n-workflows',       'https://github.com/Jharilela/n8n-workflows',       'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('abhisiroha/n8n-templates',      'https://github.com/abhisiroha/n8n-templates',      'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('dvasquez08/n8n-workflows',      'https://github.com/dvasquez08/n8n-workflows',      'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('piotrmacai/n8n',                'https://github.com/piotrmacai/n8n',                'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('MookieLian/n8n-nodes-instagram','https://github.com/MookieLian/n8n-nodes-instagram','Instagram Graph API nodes for n8n.'),
  ('shawnmcrowley/n8n_workflows',   'https://github.com/shawnmcrowley/n8n_workflows',   'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('hanson-cheng/n8n-workflows',    'https://github.com/hanson-cheng/n8n-workflows',    'n8n workflow/template repo shortlisted for Facebook/Instagram posting and marketing automation.'),
  ('Zie619/n8n-workflows',          'https://github.com/Zie619/n8n-workflows',          'Massive n8n workflow library.'),
  ('amitsax/n8nworkflows',          'https://github.com/amitsax/n8nworkflows',          'Facebook leads, posting and influencer workflows.'),
  ('enescingoz/awesome-n8n-templates', 'https://github.com/enescingoz/awesome-n8n-templates', 'AI/social templates.'),
  ('gitroomhq/postiz-app',          'https://github.com/gitroomhq/postiz-app',          'Social distribution — already self-hosted in this project (integrations/postiz).'),
  ('PostHog/posthog',               'https://github.com/PostHog/posthog',               'Behavior, funnel, retention, experimentation.'),
  ('formbricks/formbricks',         'https://github.com/formbricks/formbricks',         'Surveys, NPS, CSAT.'),
  ('mautic/mautic',                 'https://github.com/mautic/mautic',                 'Marketing automation and segmentation.'),
  ('dubinc/dub',                    'https://github.com/dubinc/dub',                    'Click attribution, partners/referrals.')
) AS v(full_name, url, note)
ON CONFLICT (tenant_id, full_name) DO NOTHING;
