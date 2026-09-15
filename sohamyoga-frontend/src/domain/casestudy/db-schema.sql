-- Case Study Engine, added 2026-09-14 -- backlog item #22. Real,
-- admin-authored case studies, each required to cite real evidence_ids
-- (#1) -- a case study with no real backing evidence cannot be published,
-- enforced at the application layer (never a marketing narrative with
-- no real data behind it).

CREATE TABLE IF NOT EXISTS case_study (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  title          TEXT          NOT NULL,
  narrative      TEXT          NOT NULL,
  evidence_ids   UUID[]        NOT NULL DEFAULT '{}', -- real evidence_record ids this case study cites
  status         VARCHAR(10)   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
