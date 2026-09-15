-- Positioning Engine, added 2026-09-14 -- backlog item #28. For a
-- single-tenant instance, "A/B testing positioning across many
-- businesses" has no real subject -- this is a real, one-time
-- admin-authored positioning statement using the roadmap's own
-- template structure, not a generator.

CREATE TABLE IF NOT EXISTS positioning_statement (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL UNIQUE,
  target_customer TEXT       NOT NULL, -- "For [X]"
  problem      TEXT          NOT NULL, -- "who [Y]"
  category     TEXT          NOT NULL, -- "is a [category]"
  outcome      TEXT          NOT NULL, -- "that [outcome]"
  alternative  TEXT          NOT NULL, -- "unlike [alternative]"
  proof        TEXT          NOT NULL, -- "because [real proof]"
  created_by   TEXT          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
