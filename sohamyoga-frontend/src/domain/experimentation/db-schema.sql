-- Real A/B testing / experimentation framework.
-- Confirmed missing in this session's 25-item management-list audit: only
-- fake on/off `*.ab_testing` FeatureFlag entries existed (referral.ab_testing,
-- survey.ab_testing, ads.ab_testing, etc.), referencing GrowthBook/PostHog as
-- a hoped-for backend with zero real variant assignment or lift measurement
-- (ads/dashboard/route.ts already honestly reported GrowthBook as
-- "not_connected" rather than inventing numbers). This is the real
-- replacement: deterministic variant bucketing, persisted assignments, and
-- conversion results computed live from the real tracking_event table —
-- never a fabricated lift number.

CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'completed', 'stopped');

CREATE TABLE experiment (
  id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID               NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  key                TEXT               NOT NULL CHECK (key <> ''),
  name               TEXT               NOT NULL CHECK (name <> ''),
  hypothesis         TEXT,
  status             experiment_status  NOT NULL DEFAULT 'draft',
  target_event_type  event_type         NOT NULL,
  minimum_sample_size INTEGER           NOT NULL DEFAULT 100 CHECK (minimum_sample_size > 0),
  created_by         TEXT,
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ        NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
CREATE INDEX idx_experiment_tenant ON experiment(tenant_id, status);

CREATE TABLE experiment_variant (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id      UUID    NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  key                TEXT    NOT NULL CHECK (key <> ''),
  name               TEXT    NOT NULL CHECK (name <> ''),
  allocation_percent INTEGER NOT NULL CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  is_control         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, key)
);
CREATE INDEX idx_experiment_variant_experiment ON experiment_variant(experiment_id);

-- Deterministic, sticky assignment: a subject (anonymous_id or user_id, the
-- same identifiers tracking_event already uses) is bucketed once and keeps
-- the same variant for the life of the experiment.
CREATE TABLE experiment_assignment (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id  UUID        NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  variant_id     UUID        NOT NULL REFERENCES experiment_variant(id) ON DELETE CASCADE,
  subject_id     TEXT        NOT NULL,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, subject_id)
);
CREATE INDEX idx_experiment_assignment_experiment ON experiment_assignment(experiment_id);
CREATE INDEX idx_experiment_assignment_subject ON experiment_assignment(subject_id);
