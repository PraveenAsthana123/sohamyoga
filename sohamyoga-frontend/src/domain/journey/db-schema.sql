-- Wave 16: Customer Journey Management — PostgreSQL Schema
-- Tables: customer_journey, wellness_goal, habit_entry, milestone_reward, journey_audit
-- Views: v_journey_summary, v_habit_streaks, v_milestone_funnel

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE journey_phase     AS ENUM ('onboarding', 'beginner', 'intermediate', 'advanced', 'ambassador');
CREATE TYPE journey_status    AS ENUM ('new', 'in_progress', 'paused', 'completed');
CREATE TYPE yoga_style        AS ENUM ('hatha', 'vinyasa', 'ashtanga', 'yin', 'restorative', 'kundalini', 'iyengar', 'prenatal', 'kids', 'senior');
CREATE TYPE practice_goal     AS ENUM ('stress_relief', 'flexibility', 'strength', 'sleep', 'weight_loss', 'mindfulness', 'injury_recovery', 'spiritual', 'general_fitness');
CREATE TYPE goal_status       AS ENUM ('active', 'achieved', 'abandoned');
CREATE TYPE habit_type        AS ENUM ('morning_yoga', 'meditation', 'breathwork', 'journaling', 'water_intake', 'sleep_target', 'step_count', 'evening_yoga', 'gratitude', 'screen_free_hour');
CREATE TYPE milestone_type    AS ENUM ('first_class', 'streak_7', 'streak_30', 'streak_90', 'streak_365', 'classes_10', 'classes_50', 'classes_100', 'classes_500', 'goal_achieved', 'phase_advanced', 'year_anniversary', 'referral_bonus');
CREATE TYPE reward_type       AS ENUM ('badge', 'points', 'coupon', 'free_class', 'certificate', 'gift');

-- ─────────────────────────────────────────────
-- 1. customer_journey
-- ─────────────────────────────────────────────

CREATE TABLE customer_journey (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             TEXT           NOT NULL UNIQUE,  -- one journey per customer
  current_phase           journey_phase  NOT NULL DEFAULT 'onboarding',
  status                  journey_status NOT NULL DEFAULT 'new',
  style_preferences       yoga_style[]   NOT NULL DEFAULT '{}',
  practice_goals          practice_goal[] NOT NULL DEFAULT '{}',
  weekly_target_minutes   INTEGER        NOT NULL DEFAULT 120 CHECK (weekly_target_minutes >= 1),
  current_streak_days     INTEGER        NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  longest_streak_days     INTEGER        NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
  total_session_count     INTEGER        NOT NULL DEFAULT 0 CHECK (total_session_count >= 0),
  total_minutes           INTEGER        NOT NULL DEFAULT 0 CHECK (total_minutes >= 0),
  joined_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  last_practice_at        TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT jrn_streak_le_longest CHECK (current_streak_days <= longest_streak_days),
  CONSTRAINT jrn_completed_is_ambassador CHECK (
    status <> 'completed' OR current_phase = 'ambassador'
  ),
  CONSTRAINT jrn_practice_after_join CHECK (
    last_practice_at IS NULL OR last_practice_at >= joined_at
  )
);

CREATE INDEX idx_journey_customer ON customer_journey (customer_id);
CREATE INDEX idx_journey_phase    ON customer_journey (current_phase);
CREATE INDEX idx_journey_status   ON customer_journey (status);
CREATE INDEX idx_journey_streak   ON customer_journey (current_streak_days DESC);

-- ─────────────────────────────────────────────
-- 2. wellness_goal
-- ─────────────────────────────────────────────

CREATE TABLE wellness_goal (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   TEXT         NOT NULL,
  journey_id    UUID         NOT NULL REFERENCES customer_journey (id) ON DELETE CASCADE,
  goal_type     practice_goal NOT NULL,
  description   TEXT         NOT NULL CHECK (description <> ''),
  progress      SMALLINT     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status        goal_status  NOT NULL DEFAULT 'active',
  target_date   DATE,
  achieved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT goal_achieved_has_date CHECK (
    status <> 'achieved' OR achieved_at IS NOT NULL
  ),
  CONSTRAINT goal_achieved_full_progress CHECK (
    status <> 'achieved' OR progress = 100
  ),
  CONSTRAINT goal_target_after_created CHECK (
    target_date IS NULL OR target_date > created_at::DATE
  )
);

CREATE INDEX idx_goal_customer  ON wellness_goal (customer_id);
CREATE INDEX idx_goal_journey   ON wellness_goal (journey_id);
CREATE INDEX idx_goal_status    ON wellness_goal (status);
CREATE INDEX idx_goal_type      ON wellness_goal (goal_type);

-- ─────────────────────────────────────────────
-- 3. habit_entry
-- ─────────────────────────────────────────────

CREATE TABLE habit_entry (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   TEXT        NOT NULL,
  journey_id    UUID        NOT NULL REFERENCES customer_journey (id) ON DELETE CASCADE,
  habit_type    habit_type  NOT NULL,
  date          DATE        NOT NULL,
  completed     BOOLEAN     NOT NULL DEFAULT FALSE,
  value         NUMERIC,    -- actual value (steps, ml, minutes)
  target_value  NUMERIC     NOT NULL CHECK (target_value >= 1),
  unit          TEXT,       -- 'ml', 'steps', 'minutes'
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (customer_id, habit_type, date),  -- one entry per habit per day

  CONSTRAINT habit_completed_has_time CHECK (
    completed = FALSE OR completed_at IS NOT NULL
  ),
  CONSTRAINT habit_value_non_negative CHECK (
    value IS NULL OR value >= 0
  )
);

CREATE INDEX idx_habit_customer  ON habit_entry (customer_id, date DESC);
CREATE INDEX idx_habit_journey   ON habit_entry (journey_id);
CREATE INDEX idx_habit_type_date ON habit_entry (habit_type, date DESC);
CREATE INDEX idx_habit_completed ON habit_entry (customer_id, completed) WHERE completed = TRUE;

-- ─────────────────────────────────────────────
-- 4. milestone_reward
-- ─────────────────────────────────────────────

CREATE TABLE milestone_reward (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    TEXT           NOT NULL,
  journey_id     UUID           NOT NULL REFERENCES customer_journey (id) ON DELETE CASCADE,
  milestone_type milestone_type NOT NULL,
  label          TEXT           NOT NULL CHECK (label <> ''),
  reward_type    reward_type    NOT NULL,
  reward_value   TEXT           NOT NULL CHECK (reward_value <> ''),
  claimed        BOOLEAN        NOT NULL DEFAULT FALSE,
  claimed_at     TIMESTAMPTZ,
  achieved_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  metadata       JSONB          NOT NULL DEFAULT '{}',

  CONSTRAINT milestone_claimed_has_time CHECK (
    claimed = FALSE OR claimed_at IS NOT NULL
  ),
  CONSTRAINT milestone_expires_after_achieved CHECK (
    expires_at IS NULL OR expires_at > achieved_at
  )
);

CREATE INDEX idx_milestone_customer ON milestone_reward (customer_id);
CREATE INDEX idx_milestone_journey  ON milestone_reward (journey_id);
CREATE INDEX idx_milestone_type     ON milestone_reward (milestone_type);
CREATE INDEX idx_milestone_claimed  ON milestone_reward (customer_id, claimed) WHERE claimed = FALSE;

-- ─────────────────────────────────────────────
-- 5. journey_audit
-- ─────────────────────────────────────────────

CREATE TABLE journey_audit (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT        NOT NULL,  -- 'health_profile_accessed', 'journey_data_exported', 'journey_deleted', 'phase_advanced'
  actor        TEXT        NOT NULL,  -- staff userId or 'system'
  customer_id  TEXT,
  journey_id   UUID        REFERENCES customer_journey (id),
  legal_basis  TEXT,                  -- GDPR/PIPEDA basis for health data access
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jrn_audit_action  ON journey_audit (action);
CREATE INDEX idx_jrn_audit_actor   ON journey_audit (actor);
CREATE INDEX idx_jrn_audit_created ON journey_audit (created_at DESC);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_journey_summary AS
SELECT
  j.id,
  j.customer_id,
  j.current_phase,
  j.status,
  j.weekly_target_minutes,
  j.current_streak_days,
  j.longest_streak_days,
  j.total_session_count,
  j.total_minutes,
  j.last_practice_at,
  COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'active')   AS active_goals,
  COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'achieved') AS achieved_goals,
  COUNT(DISTINCT m.id)                                       AS total_milestones,
  COUNT(DISTINCT m.id) FILTER (WHERE m.claimed = FALSE)     AS unclaimed_rewards
FROM customer_journey j
LEFT JOIN wellness_goal g   ON g.journey_id = j.id
LEFT JOIN milestone_reward m ON m.journey_id = j.id
GROUP BY j.id;

CREATE OR REPLACE VIEW v_habit_streaks AS
SELECT
  customer_id,
  habit_type,
  COUNT(*) FILTER (WHERE completed = TRUE)  AS completed_days,
  COUNT(*)                                   AS total_days,
  MAX(date) FILTER (WHERE completed = TRUE) AS last_completed_date,
  ROUND(
    COUNT(*) FILTER (WHERE completed = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS completion_rate_pct
FROM habit_entry
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY customer_id, habit_type
ORDER BY completion_rate_pct DESC;

CREATE OR REPLACE VIEW v_milestone_funnel AS
SELECT
  milestone_type,
  COUNT(*)                                            AS earned,
  COUNT(*) FILTER (WHERE claimed = TRUE)              AS claimed,
  ROUND(
    COUNT(*) FILTER (WHERE claimed = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS claim_rate_pct,
  AVG(EXTRACT(EPOCH FROM (claimed_at - achieved_at)) / 3600)
    FILTER (WHERE claimed = TRUE)                     AS avg_hours_to_claim
FROM milestone_reward
GROUP BY milestone_type
ORDER BY earned DESC;

-- ─────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['customer_journey', 'wellness_goal'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
