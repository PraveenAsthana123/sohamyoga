-- Research Project -- the missing foundation for the Market Research
-- Control Tower's "Screen-by-Screen" blueprint. A distinct concept from
-- research_framework/research_topic (the curated methodology knowledge
-- base): this tracks an actual project the studio/agency is running
-- (objective + real research questions), lifecycle-managed by staff.
CREATE TABLE IF NOT EXISTS research_project (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  title       VARCHAR(200)  NOT NULL,
  objective   TEXT          NOT NULL,
  status      VARCHAR(20)   NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning','fielding','analysis','completed','archived')),
  created_by  VARCHAR(120)  NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_project_tenant ON research_project (tenant_id);

CREATE TABLE IF NOT EXISTS research_question (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID          NOT NULL REFERENCES research_project(id) ON DELETE CASCADE,
  question_text TEXT          NOT NULL,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_question_project ON research_question (project_id, sort_order);
