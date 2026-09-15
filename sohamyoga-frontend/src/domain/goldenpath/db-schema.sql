-- Golden Path Registry, added 2026-09-14 -- backlog item #23. Real
-- end-to-end flows actually built and live-verified this session
-- (see docs/testing/*.md), catalogued with their real success criteria
-- and evidence of the real live run that met them -- not aspirational
-- flows that don't exist yet.

CREATE TABLE IF NOT EXISTS golden_path (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  path_key          VARCHAR(20)   NOT NULL UNIQUE,
  name              TEXT          NOT NULL,
  success_criteria  TEXT          NOT NULL,
  evidence_doc_path TEXT          NOT NULL, -- real path to the docs/testing/*.md log proving this was live-verified
  last_verified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
