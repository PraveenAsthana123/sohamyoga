-- =============================================================================
-- Poll Schema — real persistence for the Poll.ts domain model
-- Previously: Poll.ts had real vote/validate/close logic, but no DB table —
-- /community/polls rendered a hardcoded client-side mock array. This is the
-- missing persistence layer.
-- =============================================================================

CREATE TYPE poll_status AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE poll_target_segment AS ENUM ('all', 'students', 'enrolled_in_class');

CREATE TABLE poll (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  created_by_id             TEXT        NOT NULL,
  question                  TEXT        NOT NULL CHECK (question <> ''),
  status                    poll_status NOT NULL DEFAULT 'DRAFT',
  allow_multiple_votes      BOOLEAN     NOT NULL DEFAULT FALSE,
  show_results_before_close BOOLEAN     NOT NULL DEFAULT TRUE,
  ends_at                   TIMESTAMPTZ,
  target_segment            poll_target_segment NOT NULL DEFAULT 'all',
  target_class_id           UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poll_tenant ON poll(tenant_id);
CREATE INDEX idx_poll_status ON poll(status);

CREATE TABLE poll_option (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     UUID    NOT NULL REFERENCES poll(id) ON DELETE CASCADE,
  text        TEXT    NOT NULL CHECK (text <> ''),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (poll_id, text)
);

CREATE INDEX idx_poll_option_poll ON poll_option(poll_id);

-- Real duplicate-vote prevention at the DB level, not just app-code discipline.
CREATE TABLE poll_vote (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id  UUID        NOT NULL REFERENCES poll_option(id) ON DELETE CASCADE,
  voter_user_id   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_option_id, voter_user_id)
);

CREATE INDEX idx_poll_vote_option ON poll_vote(poll_option_id);
CREATE INDEX idx_poll_vote_voter  ON poll_vote(voter_user_id);
