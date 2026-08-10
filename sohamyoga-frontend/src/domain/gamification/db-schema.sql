-- Gamification DB schema
-- Custom yoga studio gamification — NOT Habitica.
-- Concepts rebuilt from scratch: points, streak, badges, milestones, challenges, leaderboard.
-- All tables include tenant_id for multi-tenancy.

-- ── Reference tables ──────────────────────────────────────────────────────────

CREATE TABLE ref_gamification_milestone_type (
  code    VARCHAR(32) PRIMARY KEY,
  label   VARCHAR(128) NOT NULL
);

INSERT INTO ref_gamification_milestone_type (code, label) VALUES
  ('class_count',       '# Classes Attended'),
  ('streak_days',       'Consecutive Practice Days'),
  ('pose_mastery',      'Pose Mastered'),
  ('enrollment_tenure', 'Active Student Duration (days)'),
  ('referral',          '# Successful Referrals'),
  ('wellness_streak',   'Consecutive Wellness Log Days'),
  ('community',         'Community Posts / Comments');

CREATE TABLE ref_milestone_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_milestone_status (code) VALUES
  ('locked'), ('in_progress'), ('earned'), ('claimed');

CREATE TABLE ref_challenge_type (
  code  VARCHAR(32) PRIMARY KEY
);
INSERT INTO ref_challenge_type (code) VALUES
  ('individual'), ('group'), ('teacher_vs_students'), ('studio_wide');

CREATE TABLE ref_challenge_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_challenge_status (code) VALUES
  ('upcoming'), ('active'), ('completed'), ('cancelled');

-- ── Points ledger ─────────────────────────────────────────────────────────────

CREATE TABLE points_ledger (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  user_id        UUID          NOT NULL,
  amount         INTEGER       NOT NULL,       -- positive = earn, negative = spend
  balance_after  INTEGER       NOT NULL,
  reason         VARCHAR(128)  NOT NULL,       -- 'class_attended', 'badge_earned', 'reward_redeemed', ...
  reference_id   UUID,                         -- booking_id, badge_id, challenge_id, etc.
  reference_type VARCHAR(64),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ledger_amount CHECK (amount <> 0)
);

CREATE INDEX idx_points_ledger_user     ON points_ledger (tenant_id, user_id, created_at DESC);
CREATE INDEX idx_points_ledger_ref      ON points_ledger (reference_id, reference_type) WHERE reference_id IS NOT NULL;

-- Current balance view (latest balance_after per user)
CREATE VIEW v_user_balance AS
  SELECT DISTINCT ON (tenant_id, user_id)
    tenant_id,
    user_id,
    balance_after AS current_balance,
    created_at    AS last_transaction_at
  FROM points_ledger
  ORDER BY tenant_id, user_id, created_at DESC;

-- ── Streak ────────────────────────────────────────────────────────────────────

CREATE TABLE streak (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  user_id             UUID         NOT NULL UNIQUE,
  current_streak      INTEGER      NOT NULL DEFAULT 0,
  longest_streak      INTEGER      NOT NULL DEFAULT 0,
  last_activity_date  DATE,                       -- date of last qualifying activity
  freeze_tokens       SMALLINT     NOT NULL DEFAULT 0,  -- earned by hitting milestones
  total_active_days   INTEGER      NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_streak_non_negative    CHECK (current_streak >= 0),
  CONSTRAINT chk_longest_non_negative   CHECK (longest_streak >= 0),
  CONSTRAINT chk_freeze_non_negative    CHECK (freeze_tokens >= 0)
);

CREATE TABLE streak_event (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  user_id      UUID         NOT NULL,
  event_type   VARCHAR(32)  NOT NULL,   -- 'activity_logged', 'freeze_used', 'streak_reset', 'streak_milestone'
  streak_value INTEGER      NOT NULL,   -- streak value at time of event
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_streak_event_user ON streak_event (tenant_id, user_id, occurred_at DESC);

-- ── Badge catalog ─────────────────────────────────────────────────────────────

CREATE TABLE badge (
  id            VARCHAR(16)   PRIMARY KEY,   -- e.g. 'b1', 'b2', 'b10'
  tenant_id     UUID          NOT NULL,
  name          VARCHAR(128)  NOT NULL,
  description   TEXT,
  icon_url      TEXT,
  category      VARCHAR(64)   NOT NULL,  -- 'streak', 'class_count', 'community', 'milestone', 'special'
  points_value  INTEGER       NOT NULL DEFAULT 0,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed badges (10 initial, matching SEED_BADGES concept)
INSERT INTO badge (id, tenant_id, name, description, category, points_value) VALUES
  ('b1',  '00000000-0000-0000-0000-000000000001', 'First Class',          'Attended your very first yoga class',           'class_count', 10),
  ('b2',  '00000000-0000-0000-0000-000000000001', 'Dedicated Practitioner','Attended 10 classes',                          'class_count', 50),
  ('b3',  '00000000-0000-0000-0000-000000000001', 'Regular Student',       'Attended 30 classes',                          'class_count', 100),
  ('b4',  '00000000-0000-0000-0000-000000000001', 'Century Club',          'Attended 100 classes',                         'class_count', 300),
  ('b5',  '00000000-0000-0000-0000-000000000001', 'One Week Warrior',      '7-day consecutive practice streak',            'streak', 50),
  ('b6',  '00000000-0000-0000-0000-000000000001', 'Month of Mindfulness',  '30-day consecutive practice streak',           'streak', 200),
  ('b7',  '00000000-0000-0000-0000-000000000001', 'Pose Pioneer',          'Mastered your first pose',                     'milestone', 75),
  ('b8',  '00000000-0000-0000-0000-000000000001', 'Community Voice',       'First post in the community feed',             'community', 25),
  ('b9',  '00000000-0000-0000-0000-000000000001', 'Community Champion',    '10+ community posts or comments',              'community', 100),
  ('b10', '00000000-0000-0000-0000-000000000001', 'Referral Champion',     'Referred 3 friends who became students',       'special', 200);

-- ── Achievement (badge awarded to a user) ─────────────────────────────────────

CREATE TABLE achievement (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL,
  user_id     UUID         NOT NULL,
  badge_id    VARCHAR(16)  NOT NULL REFERENCES badge(id),
  earned_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  source      VARCHAR(64)  NOT NULL,    -- 'milestone_auto', 'admin_award', 'challenge_win'
  source_id   UUID,
  UNIQUE (tenant_id, user_id, badge_id)   -- each badge earned once per user
);

CREATE INDEX idx_achievement_user ON achievement (tenant_id, user_id, earned_at DESC);

-- ── Milestone ─────────────────────────────────────────────────────────────────

CREATE TABLE milestone (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  user_id          UUID         NOT NULL,
  milestone_type   VARCHAR(32)  NOT NULL REFERENCES ref_gamification_milestone_type(code),
  threshold        INTEGER      NOT NULL,
  current_progress INTEGER      NOT NULL DEFAULT 0,
  status           VARCHAR(16)  NOT NULL DEFAULT 'locked' REFERENCES ref_milestone_status(code),
  -- Reward payload
  reward_xp        INTEGER      NOT NULL DEFAULT 0,
  reward_points    INTEGER      NOT NULL DEFAULT 0,
  reward_badge_id  VARCHAR(16)  REFERENCES badge(id),
  reward_coupon    VARCHAR(64),
  reward_feature   VARCHAR(128),
  --
  earned_at        TIMESTAMPTZ,
  claimed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_milestone_threshold     CHECK (threshold > 0),
  CONSTRAINT chk_milestone_progress      CHECK (current_progress >= 0),
  CONSTRAINT chk_milestone_earned_at     CHECK (status != 'earned'  OR earned_at  IS NOT NULL),
  CONSTRAINT chk_milestone_claimed_at    CHECK (status != 'claimed' OR claimed_at IS NOT NULL),
  UNIQUE (tenant_id, user_id, milestone_type, threshold)
);

CREATE INDEX idx_milestone_user        ON milestone (tenant_id, user_id, status);
CREATE INDEX idx_milestone_unclaimed   ON milestone (tenant_id, status) WHERE status = 'earned';

-- ── Challenge ─────────────────────────────────────────────────────────────────

CREATE TABLE challenge (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  name              VARCHAR(256) NOT NULL,
  description       TEXT,
  challenge_type    VARCHAR(32)  NOT NULL DEFAULT 'group' REFERENCES ref_challenge_type(code),
  status            VARCHAR(16)  NOT NULL DEFAULT 'upcoming' REFERENCES ref_challenge_status(code),
  metric            VARCHAR(64)  NOT NULL,   -- 'classes_attended', 'streak_days', 'poses_mastered', etc.
  target_value      INTEGER      NOT NULL,
  start_date        DATE         NOT NULL,
  end_date          DATE         NOT NULL,
  participant_count INTEGER      NOT NULL DEFAULT 0,
  -- Reward
  reward_xp         INTEGER      NOT NULL DEFAULT 0,
  reward_points     INTEGER      NOT NULL DEFAULT 0,
  reward_badge_id   VARCHAR(16)  REFERENCES badge(id),
  reward_coupon     VARCHAR(64),
  created_by        UUID         NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_challenge_target      CHECK (target_value > 0),
  CONSTRAINT chk_challenge_dates       CHECK (end_date > start_date),
  CONSTRAINT chk_challenge_participants CHECK (participant_count >= 0)
);

CREATE INDEX idx_challenge_tenant_status ON challenge (tenant_id, status, start_date);

-- ── Challenge participation ───────────────────────────────────────────────────

CREATE TABLE challenge_participation (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  challenge_id     UUID         NOT NULL REFERENCES challenge(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL,
  current_progress INTEGER      NOT NULL DEFAULT 0,
  rank             INTEGER,
  joined_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_participation_progress CHECK (current_progress >= 0),
  CONSTRAINT chk_participation_rank     CHECK (rank IS NULL OR rank >= 1),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_cp_challenge ON challenge_participation (challenge_id, rank NULLS LAST, current_progress DESC);
CREATE INDEX idx_cp_user      ON challenge_participation (tenant_id, user_id, joined_at DESC);

-- ── Leaderboard entry (materialised snapshot) ─────────────────────────────────

CREATE TABLE leaderboard_entry (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  board_type      VARCHAR(32)  NOT NULL,   -- 'monthly_points', 'all_time_streak', 'challenge_<id>'
  board_period    VARCHAR(16)  NOT NULL,   -- 'YYYY-MM' for monthly, 'all_time', challenge id
  user_id         UUID         NOT NULL,
  display_name    VARCHAR(128) NOT NULL,
  avatar_url      TEXT,
  score           BIGINT       NOT NULL,
  rank            INTEGER      NOT NULL,
  delta_rank      INTEGER      NOT NULL DEFAULT 0,   -- vs previous period
  snapshotted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lb_rank  CHECK (rank >= 1),
  UNIQUE (tenant_id, board_type, board_period, user_id)
);

CREATE INDEX idx_lb_board ON leaderboard_entry (tenant_id, board_type, board_period, rank);

-- ── Reward transaction ────────────────────────────────────────────────────────

CREATE TABLE reward_transaction (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  user_id           UUID         NOT NULL,
  reward_type       VARCHAR(32)  NOT NULL,  -- 'points', 'badge', 'coupon', 'free_class', 'feature_unlock'
  reward_reference  UUID,                   -- badge_id, coupon_id, etc.
  source_type       VARCHAR(64)  NOT NULL,  -- 'milestone', 'challenge_win', 'streak_freeze', 'admin_grant'
  source_id         UUID,
  issued_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  claimed_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ
);

CREATE INDEX idx_reward_user ON reward_transaction (tenant_id, user_id, issued_at DESC);

-- ── Views ─────────────────────────────────────────────────────────────────────

-- User gamification summary
CREATE VIEW v_user_gamification_summary AS
  SELECT
    s.tenant_id,
    s.user_id,
    COALESCE(b.current_balance, 0)        AS current_points,
    s.current_streak,
    s.longest_streak,
    s.total_active_days,
    s.freeze_tokens,
    COUNT(DISTINCT a.badge_id)            AS badge_count,
    COUNT(DISTINCT CASE WHEN m.status = 'earned' AND m.claimed_at IS NULL
                        THEN m.id END)    AS unclaimed_milestones
  FROM streak s
  LEFT JOIN v_user_balance b  ON b.tenant_id = s.tenant_id AND b.user_id = s.user_id
  LEFT JOIN achievement a     ON a.tenant_id = s.tenant_id AND a.user_id = s.user_id
  LEFT JOIN milestone m       ON m.tenant_id = s.tenant_id AND m.user_id = s.user_id
  GROUP BY s.tenant_id, s.user_id, b.current_balance,
           s.current_streak, s.longest_streak, s.total_active_days, s.freeze_tokens;

-- Active challenges open for participation
CREATE VIEW v_active_challenges AS
  SELECT *
  FROM challenge
  WHERE status = 'active'
    AND CURRENT_DATE BETWEEN start_date AND end_date;
