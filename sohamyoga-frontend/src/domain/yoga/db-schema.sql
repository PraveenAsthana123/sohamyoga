-- =============================================================================
-- Wave 19: Yoga-Specific Library — DB Schema
-- Table-driven: all enum codes reference ref_* lookup tables
-- Tenant-driven: tenant_id FK on every domain table
-- Model-driven: Asana + Pranayama + ClassSequence + MeditationSession drive structure
-- Run AFTER: src/domain/core/db-foundation.sql
-- =============================================================================

-- ─── Reference / Master Tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_yoga_style (
  code        VARCHAR(20) PRIMARY KEY,
  label       VARCHAR(60) NOT NULL,
  description TEXT,
  difficulty  VARCHAR(20), -- primary difficulty level
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- The foundation schema owns this shared reference table and historically
-- called the flag `active`. Keep both names available for Yoga-domain queries.
ALTER TABLE ref_yoga_style ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO ref_yoga_style (code, label, difficulty, sort_order) VALUES
  ('hatha',      'Hatha Yoga',       'beginner',     1),
  ('vinyasa',    'Vinyasa Flow',     'intermediate', 2),
  ('ashtanga',   'Ashtanga',         'advanced',     3),
  ('iyengar',    'Iyengar',          'intermediate', 4),
  ('kundalini',  'Kundalini',        'intermediate', 5),
  ('yin',        'Yin Yoga',         'beginner',     6),
  ('restorative','Restorative Yoga', 'beginner',     7),
  ('bikram',     'Bikram / Hot Yoga','intermediate', 8),
  ('power',      'Power Yoga',       'advanced',     9),
  ('aerial',     'Aerial Yoga',      'intermediate', 10),
  ('prenatal',   'Prenatal Yoga',    'all',          11),
  ('kids',       'Kids Yoga',        'all',          12)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_difficulty_level (
  code       VARCHAR(20) PRIMARY KEY,
  label      VARCHAR(40) NOT NULL,
  rank       SMALLINT NOT NULL  -- 1=beginner, 2=intermediate, 3=advanced, 0=all_levels
);

INSERT INTO ref_difficulty_level (code, label, rank) VALUES
  ('beginner',     'Beginner',     1),
  ('intermediate', 'Intermediate', 2),
  ('advanced',     'Advanced',     3),
  ('all_levels',   'All Levels',   0)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_body_part (
  code       VARCHAR(20) PRIMARY KEY,
  label      VARCHAR(40) NOT NULL,
  region     VARCHAR(20)  -- 'upper' | 'core' | 'lower' | 'full'
);

INSERT INTO ref_body_part (code, label, region) VALUES
  ('hips',       'Hips',       'lower'),
  ('hamstrings', 'Hamstrings', 'lower'),
  ('shoulders',  'Shoulders',  'upper'),
  ('back',       'Back',       'core'),
  ('core',       'Core',       'core'),
  ('chest',      'Chest',      'upper'),
  ('neck',       'Neck',       'upper'),
  ('arms',       'Arms',       'upper'),
  ('legs',       'Legs',       'lower'),
  ('wrists',     'Wrists',     'upper'),
  ('ankles',     'Ankles',     'lower'),
  ('spine',      'Spine',      'core')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_dosha_type (
  code       VARCHAR(10) PRIMARY KEY,
  label      VARCHAR(30) NOT NULL,
  element    VARCHAR(40) NOT NULL
);

INSERT INTO ref_dosha_type (code, label, element) VALUES
  ('vata',  'Vata',  'Air + Space'),
  ('pitta', 'Pitta', 'Fire + Water'),
  ('kapha', 'Kapha', 'Earth + Water')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_session_goal (
  code       VARCHAR(30) PRIMARY KEY,
  label      VARCHAR(60) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_session_goal (code, label, sort_order) VALUES
  ('stress_relief',   'Stress Relief',    1),
  ('flexibility',     'Flexibility',      2),
  ('strength',        'Strength',         3),
  ('balance',         'Balance',          4),
  ('energy',          'Energy Boost',     5),
  ('sleep',           'Better Sleep',     6),
  ('injury_recovery', 'Injury Recovery',  7),
  ('mindfulness',     'Mindfulness',      8)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_pranayama_pattern (
  code         VARCHAR(30) PRIMARY KEY,
  label        VARCHAR(60) NOT NULL,
  is_energising BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO ref_pranayama_pattern (code, label, is_energising) VALUES
  ('box',               'Box Breathing (Sama Vritti)', FALSE),
  ('ratio',             'Custom Ratio',                FALSE),
  ('alternate_nostril', 'Nadi Shodhana',               FALSE),
  ('bellows',           'Kapalabhati',                 TRUE),
  ('cooling',           'Sitali / Sitkari',            FALSE),
  ('humming',           'Bhramari',                    FALSE),
  ('ocean',             'Ujjayi (Ocean Breath)',        FALSE),
  ('skull_shining',     'Bhastrika',                   TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_meditation_style (
  code         VARCHAR(30) PRIMARY KEY,
  label        VARCHAR(60) NOT NULL,
  typical_duration_min SMALLINT,
  sort_order   SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_meditation_style (code, label, typical_duration_min, sort_order) VALUES
  ('mindfulness',          'Mindfulness Meditation',     10, 1),
  ('guided_visualization', 'Guided Visualization',       15, 2),
  ('yoga_nidra',           'Yoga Nidra',                 30, 3),
  ('mantra',               'Mantra Meditation',          20, 4),
  ('breathing',            'Breathing Meditation',        5, 5),
  ('body_scan',            'Body Scan',                  15, 6),
  ('loving_kindness',      'Loving Kindness (Metta)',    10, 7),
  ('chakra',               'Chakra Meditation',          20, 8),
  ('movement',             'Movement Meditation',        10, 9)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_sequence_goal (
  code        VARCHAR(30) PRIMARY KEY,
  label       VARCHAR(60) NOT NULL
);
INSERT INTO ref_sequence_goal SELECT code, label FROM ref_session_goal ON CONFLICT DO NOTHING;

-- ─── Asana (Pose Library) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asana (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sanskrit_name    VARCHAR(100) NOT NULL,
  english_name     VARCHAR(100) NOT NULL,
  alternate_names  TEXT[]      NOT NULL DEFAULT '{}',
  description      TEXT        NOT NULL DEFAULT '',
  difficulty_level VARCHAR(20) NOT NULL REFERENCES ref_difficulty_level(code),
  duration_seconds SMALLINT    CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  repetitions      SMALLINT    CHECK (repetitions IS NULL OR repetitions > 0),
  image_url        TEXT,
  video_url        TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sanskrit_name)
);

CREATE INDEX IF NOT EXISTS idx_asana_tenant     ON asana(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asana_difficulty ON asana(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_asana_active     ON asana(is_active);

CREATE TABLE IF NOT EXISTS asana_body_part (
  asana_id  UUID        NOT NULL REFERENCES asana(id) ON DELETE CASCADE,
  part_code VARCHAR(20) NOT NULL REFERENCES ref_body_part(code),
  PRIMARY KEY (asana_id, part_code)
);

CREATE TABLE IF NOT EXISTS asana_style (
  asana_id   UUID        NOT NULL REFERENCES asana(id) ON DELETE CASCADE,
  style_code VARCHAR(20) NOT NULL REFERENCES ref_yoga_style(code),
  PRIMARY KEY (asana_id, style_code)
);

CREATE TABLE IF NOT EXISTS asana_dosha (
  asana_id   UUID        NOT NULL REFERENCES asana(id) ON DELETE CASCADE,
  dosha_code VARCHAR(10) NOT NULL REFERENCES ref_dosha_type(code),
  PRIMARY KEY (asana_id, dosha_code)
);

CREATE TABLE IF NOT EXISTS asana_contraindication (
  id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  asana_id    UUID   NOT NULL REFERENCES asana(id) ON DELETE CASCADE,
  condition   TEXT   NOT NULL,
  UNIQUE (asana_id, condition)
);

CREATE TABLE IF NOT EXISTS asana_prop (
  asana_id  UUID  NOT NULL REFERENCES asana(id) ON DELETE CASCADE,
  prop_name TEXT  NOT NULL,
  PRIMARY KEY (asana_id, prop_name)
);

CREATE TABLE IF NOT EXISTS asana_goal (
  asana_id  UUID        NOT NULL REFERENCES asana(id) ON DELETE CASCADE,
  goal_code VARCHAR(30) NOT NULL REFERENCES ref_session_goal(code),
  PRIMARY KEY (asana_id, goal_code)
);

-- ─── Pranayama ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pranayama (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sanskrit_name    VARCHAR(100) NOT NULL,
  english_name     VARCHAR(100) NOT NULL,
  pattern          VARCHAR(30) NOT NULL REFERENCES ref_pranayama_pattern(code),
  rounds           SMALLINT    NOT NULL CHECK (rounds >= 1),
  duration_minutes SMALLINT    NOT NULL CHECK (duration_minutes >= 1),
  difficulty_level VARCHAR(20) NOT NULL REFERENCES ref_difficulty_level(code),
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sanskrit_name)
);

CREATE TABLE IF NOT EXISTS pranayama_ratio_step (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pranayama_id UUID        NOT NULL REFERENCES pranayama(id) ON DELETE CASCADE,
  step_order   SMALLINT    NOT NULL,   -- 1-based
  phase        VARCHAR(20) NOT NULL CHECK (phase IN ('inhale','hold_in','exhale','hold_out')),
  counts       SMALLINT    NOT NULL CHECK (counts >= 1),
  UNIQUE (pranayama_id, step_order)
);

CREATE TABLE IF NOT EXISTS pranayama_benefit (
  pranayama_id UUID NOT NULL REFERENCES pranayama(id) ON DELETE CASCADE,
  benefit      TEXT NOT NULL,
  PRIMARY KEY (pranayama_id, benefit)
);

CREATE TABLE IF NOT EXISTS pranayama_contraindication (
  pranayama_id UUID NOT NULL REFERENCES pranayama(id) ON DELETE CASCADE,
  condition    TEXT NOT NULL,
  PRIMARY KEY (pranayama_id, condition)
);

CREATE TABLE IF NOT EXISTS pranayama_dosha (
  pranayama_id UUID        NOT NULL REFERENCES pranayama(id) ON DELETE CASCADE,
  dosha_code   VARCHAR(10) NOT NULL REFERENCES ref_dosha_type(code),
  PRIMARY KEY (pranayama_id, dosha_code)
);

-- ─── Class Sequence ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS class_sequence (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  teacher_id       UUID        NOT NULL,
  title            VARCHAR(200) NOT NULL,
  style            VARCHAR(20) NOT NULL REFERENCES ref_yoga_style(code),
  difficulty_level VARCHAR(20) NOT NULL REFERENCES ref_difficulty_level(code),
  is_template      BOOLEAN     NOT NULL DEFAULT FALSE,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seq_tenant    ON class_sequence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seq_teacher   ON class_sequence(teacher_id);
CREATE INDEX IF NOT EXISTS idx_seq_template  ON class_sequence(is_template) WHERE is_template = TRUE;

CREATE TABLE IF NOT EXISTS sequence_item (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id      UUID        NOT NULL REFERENCES class_sequence(id) ON DELETE CASCADE,
  item_order       SMALLINT    NOT NULL CHECK (item_order >= 1),
  asana_id         UUID        NOT NULL REFERENCES asana(id),
  duration_seconds SMALLINT    NOT NULL CHECK (duration_seconds >= 10),
  cues             TEXT,
  side             VARCHAR(10) CHECK (side IN ('left','right','both')),
  transition_note  TEXT,
  UNIQUE (sequence_id, item_order)
);

CREATE TABLE IF NOT EXISTS sequence_goal (
  sequence_id UUID        NOT NULL REFERENCES class_sequence(id) ON DELETE CASCADE,
  goal_code   VARCHAR(30) NOT NULL REFERENCES ref_sequence_goal(code),
  PRIMARY KEY (sequence_id, goal_code)
);

-- ─── Meditation Session ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meditation_session (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL,
  style            VARCHAR(30) NOT NULL REFERENCES ref_meditation_style(code),
  duration_minutes SMALLINT    NOT NULL CHECK (duration_minutes >= 1),
  description      TEXT        NOT NULL DEFAULT '',
  audio_url        TEXT,
  video_url        TEXT,
  transcript       TEXT,
  instructor       VARCHAR(200),
  language         CHAR(2)     NOT NULL DEFAULT 'en',
  difficulty_level VARCHAR(20) NOT NULL REFERENCES ref_difficulty_level(code),
  status           VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  play_count       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_tenant ON meditation_session(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_style  ON meditation_session(style);
CREATE INDEX IF NOT EXISTS idx_med_status ON meditation_session(status);

CREATE TABLE IF NOT EXISTS meditation_tag (
  session_id UUID NOT NULL REFERENCES meditation_session(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  PRIMARY KEY (session_id, tag)
);

CREATE TABLE IF NOT EXISTS meditation_goal (
  session_id UUID        NOT NULL REFERENCES meditation_session(id) ON DELETE CASCADE,
  goal_code  VARCHAR(30) NOT NULL REFERENCES ref_session_goal(code),
  PRIMARY KEY (session_id, goal_code)
);

CREATE TABLE IF NOT EXISTS meditation_dosha (
  session_id UUID        NOT NULL REFERENCES meditation_session(id) ON DELETE CASCADE,
  dosha_code VARCHAR(10) NOT NULL REFERENCES ref_dosha_type(code),
  PRIMARY KEY (session_id, dosha_code)
);

-- ─── Mudra Library (Reference) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mudra (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sanskrit_name     VARCHAR(100) NOT NULL,
  english_name      VARCHAR(100) NOT NULL,
  type              VARCHAR(20) NOT NULL CHECK (type IN ('hand','body','postural','face','eye')),
  description       TEXT        NOT NULL DEFAULT '',
  hold_duration_sec SMALLINT    NOT NULL DEFAULT 0 CHECK (hold_duration_sec >= 0),
  chakra            VARCHAR(60),
  image_url         TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sanskrit_name)
);

-- ─── Views ────────────────────────────────────────────────────────────────────

-- Asana with dosha + style arrays for single-query catalog display
CREATE OR REPLACE VIEW v_asana_catalog AS
SELECT
  a.id,
  a.tenant_id,
  a.sanskrit_name,
  a.english_name,
  a.difficulty_level,
  a.duration_seconds,
  a.is_active,
  COALESCE(ARRAY_AGG(DISTINCT ab.part_code) FILTER (WHERE ab.part_code IS NOT NULL), '{}') AS body_parts,
  COALESCE(ARRAY_AGG(DISTINCT ast.style_code) FILTER (WHERE ast.style_code IS NOT NULL), '{}') AS styles,
  COALESCE(ARRAY_AGG(DISTINCT ad.dosha_code) FILTER (WHERE ad.dosha_code IS NOT NULL), '{}') AS doshas,
  COALESCE(ARRAY_AGG(DISTINCT ag.goal_code) FILTER (WHERE ag.goal_code IS NOT NULL), '{}') AS goals
FROM asana a
LEFT JOIN asana_body_part ab ON ab.asana_id = a.id
LEFT JOIN asana_style ast    ON ast.asana_id = a.id
LEFT JOIN asana_dosha ad     ON ad.asana_id  = a.id
LEFT JOIN asana_goal ag      ON ag.asana_id  = a.id
WHERE a.is_active = TRUE
GROUP BY a.id;

-- Sequence usage — how many sequences reference each asana
CREATE OR REPLACE VIEW v_asana_sequence_usage AS
SELECT
  a.id           AS asana_id,
  a.english_name,
  a.tenant_id,
  COUNT(si.id)   AS sequence_count
FROM asana a
LEFT JOIN sequence_item si ON si.asana_id = a.id
GROUP BY a.id, a.english_name, a.tenant_id;

-- Published meditation sessions with play stats
CREATE OR REPLACE VIEW v_meditation_stats AS
SELECT
  ms.id,
  ms.tenant_id,
  ms.title,
  ms.style,
  ms.duration_minutes,
  ms.language,
  ms.play_count,
  ms.instructor,
  COALESCE(ARRAY_AGG(DISTINCT mt.tag) FILTER (WHERE mt.tag IS NOT NULL), '{}') AS tags
FROM meditation_session ms
LEFT JOIN meditation_tag mt ON mt.session_id = ms.id
WHERE ms.status = 'published'
GROUP BY ms.id;
