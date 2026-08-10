-- ============================================================
-- Wave 11: Survey / Questionnaire / Form / Feedback Module
-- Database Schema
-- ============================================================

-- -------------------------------------------------------
-- 1. survey — master survey record
-- -------------------------------------------------------
CREATE TABLE survey (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  VARCHAR(200)  NOT NULL UNIQUE,
  title                 VARCHAR(500)  NOT NULL,
  description           TEXT,
  type                  VARCHAR(50)   NOT NULL CHECK (type IN ('survey','questionnaire','form','quiz','assessment','poll','nps','feedback')),
  status                VARCHAR(30)   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','closed','archived')),
  visibility            VARCHAR(30)   NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','authenticated','invite_only','anonymous')),
  language              VARCHAR(10)   NOT NULL DEFAULT 'en',
  allow_anonymous       BOOLEAN       NOT NULL DEFAULT TRUE,
  require_login         BOOLEAN       NOT NULL DEFAULT FALSE,
  allow_multiple        BOOLEAN       NOT NULL DEFAULT FALSE,
  show_progress_bar     BOOLEAN       NOT NULL DEFAULT TRUE,
  randomize_questions   BOOLEAN       NOT NULL DEFAULT FALSE,
  save_and_resume       BOOLEAN       NOT NULL DEFAULT FALSE,
  response_limit        INTEGER,
  start_date            TIMESTAMPTZ,
  end_date              TIMESTAMPTZ,
  confirmation_message  TEXT,
  redirect_url          VARCHAR(1000),
  response_count        INTEGER       NOT NULL DEFAULT 0,
  completion_count      INTEGER       NOT NULL DEFAULT 0,
  created_by            UUID          NOT NULL,
  published_by          UUID,
  closed_by             UUID,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  published_at          TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  CONSTRAINT survey_response_limit_min CHECK (response_limit IS NULL OR response_limit >= 1),
  CONSTRAINT survey_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date),
  CONSTRAINT survey_completion_lte_response CHECK (completion_count <= response_count)
);

CREATE INDEX idx_survey_status   ON survey (status);
CREATE INDEX idx_survey_type     ON survey (type);
CREATE INDEX idx_survey_slug     ON survey (slug);
CREATE INDEX idx_survey_created  ON survey (created_at DESC);

-- -------------------------------------------------------
-- 2. survey_question — individual questions
-- -------------------------------------------------------
CREATE TABLE survey_question (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id             UUID          NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
  type                  VARCHAR(50)   NOT NULL CHECK (type IN (
    'single_choice','multiple_choice','checkbox','rating_scale','matrix_grid',
    'short_text','long_text','file_upload','digital_signature',
    'date','number','email','phone','nps'
  )),
  text                  TEXT          NOT NULL,
  description           TEXT,
  is_required           BOOLEAN       NOT NULL DEFAULT FALSE,
  display_order         INTEGER       NOT NULL DEFAULT 0,
  rating_min            INTEGER,
  rating_max            INTEGER,
  rating_min_label      VARCHAR(100),
  rating_max_label      VARCHAR(100),
  placeholder           VARCHAR(500),
  max_length            INTEGER,
  max_file_size_mb      NUMERIC(10,2),
  allowed_file_types    TEXT[],
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT question_rating_order CHECK (rating_min IS NULL OR rating_max IS NULL OR rating_min < rating_max),
  CONSTRAINT question_max_length_min CHECK (max_length IS NULL OR max_length >= 1),
  CONSTRAINT question_file_size_positive CHECK (max_file_size_mb IS NULL OR max_file_size_mb > 0)
);

CREATE INDEX idx_question_survey   ON survey_question (survey_id, display_order);
CREATE INDEX idx_question_type     ON survey_question (type);

-- -------------------------------------------------------
-- 3. survey_question_option — choices for choice/matrix questions
-- -------------------------------------------------------
CREATE TABLE survey_question_option (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID         NOT NULL REFERENCES survey_question(id) ON DELETE CASCADE,
  label         VARCHAR(500) NOT NULL,
  value         VARCHAR(500) NOT NULL,
  display_order INTEGER      NOT NULL DEFAULT 0,
  is_other      BOOLEAN      NOT NULL DEFAULT FALSE,
  is_matrix_row BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_option_question ON survey_question_option (question_id, display_order);

-- -------------------------------------------------------
-- 4. survey_question_logic — conditional show/skip logic
-- -------------------------------------------------------
CREATE TABLE survey_question_logic (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id           UUID        NOT NULL REFERENCES survey_question(id) ON DELETE CASCADE,
  depends_on_question   UUID        NOT NULL REFERENCES survey_question(id),
  operator              VARCHAR(20) NOT NULL CHECK (operator IN ('equals','not_equals','contains','greater_than','less_than')),
  value                 TEXT        NOT NULL,
  action                VARCHAR(10) NOT NULL CHECK (action IN ('show','skip')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

-- -------------------------------------------------------
-- 5. survey_response — one response per respondent per survey
-- -------------------------------------------------------
CREATE TABLE survey_response (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id           UUID         NOT NULL REFERENCES survey(id),
  respondent_id       UUID,
  respondent_email    VARCHAR(320),
  status              VARCHAR(20)  NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','partial')),
  completion_percent  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  ip_address          INET,
  user_agent          TEXT,
  referrer            VARCHAR(1000),
  time_spent_seconds  INTEGER,
  started_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT response_submitted_has_date CHECK (status != 'submitted' OR submitted_at IS NOT NULL),
  CONSTRAINT response_time_positive CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0)
);

CREATE INDEX idx_response_survey    ON survey_response (survey_id, status);
CREATE INDEX idx_response_respondent ON survey_response (respondent_id);
CREATE INDEX idx_response_submitted  ON survey_response (submitted_at DESC);

-- -------------------------------------------------------
-- 6. survey_answer — individual answers within a response
-- -------------------------------------------------------
CREATE TABLE survey_answer (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     UUID        NOT NULL REFERENCES survey_response(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES survey_question(id),
  question_type   VARCHAR(50) NOT NULL,
  value_text      TEXT,
  value_number    NUMERIC,
  value_array     TEXT[],
  file_url        VARCHAR(1000),
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (response_id, question_id)
);

CREATE INDEX idx_answer_response  ON survey_answer (response_id);
CREATE INDEX idx_answer_question  ON survey_answer (question_id);

-- -------------------------------------------------------
-- 7. survey_analytics — aggregated stats per survey
-- -------------------------------------------------------
CREATE TABLE survey_analytics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id             UUID          NOT NULL REFERENCES survey(id) ON DELETE CASCADE UNIQUE,
  total_responses       INTEGER       NOT NULL DEFAULT 0,
  completed_responses   INTEGER       NOT NULL DEFAULT 0,
  partial_responses     INTEGER       NOT NULL DEFAULT 0,
  completion_rate       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  average_time_seconds  INTEGER       NOT NULL DEFAULT 0,
  nps_score             NUMERIC(5,2),
  calculated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT analytics_nps_range CHECK (nps_score IS NULL OR (nps_score >= -100 AND nps_score <= 100)),
  CONSTRAINT analytics_rate_range CHECK (completion_rate >= 0 AND completion_rate <= 100)
);

-- -------------------------------------------------------
-- 8. survey_question_summary — per-question analytics
-- -------------------------------------------------------
CREATE TABLE survey_question_summary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analytics_id    UUID        NOT NULL REFERENCES survey_analytics(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES survey_question(id),
  question_text   TEXT        NOT NULL,
  question_type   VARCHAR(50) NOT NULL,
  total_answers   INTEGER     NOT NULL DEFAULT 0,
  skipped_count   INTEGER     NOT NULL DEFAULT 0,
  option_counts   JSONB,
  average_rating  NUMERIC(5,2),
  nps_score       NUMERIC(5,2),
  promoters       INTEGER,
  passives        INTEGER,
  detractors      INTEGER,
  text_sample     TEXT[],
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analytics_id, question_id)
);

-- -------------------------------------------------------
-- 9. survey_invitation — email invitations sent to respondents
-- -------------------------------------------------------
CREATE TABLE survey_invitation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID         NOT NULL REFERENCES survey(id),
  email           VARCHAR(320) NOT NULL,
  token           VARCHAR(64)  NOT NULL UNIQUE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','opened','started','completed','bounced')),
  sent_by         UUID         NOT NULL,
  sent_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  opened_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  UNIQUE (survey_id, email)
);

CREATE INDEX idx_invitation_survey ON survey_invitation (survey_id, status);
CREATE INDEX idx_invitation_token  ON survey_invitation (token);
CREATE INDEX idx_invitation_email  ON survey_invitation (email);

-- -------------------------------------------------------
-- 10. survey_export — generated export records
-- -------------------------------------------------------
CREATE TABLE survey_export (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id     UUID         NOT NULL REFERENCES survey(id),
  format        VARCHAR(10)  NOT NULL CHECK (format IN ('csv','xlsx','spss','json')),
  file_url      VARCHAR(1000),
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  row_count     INTEGER,
  file_size_kb  INTEGER,
  requested_by  UUID         NOT NULL,
  requested_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ
);

CREATE INDEX idx_export_survey  ON survey_export (survey_id, requested_at DESC);

-- -------------------------------------------------------
-- 11. survey_audit — audit trail for all survey mutations
-- -------------------------------------------------------
CREATE TABLE survey_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50)  NOT NULL,
  entity_id     UUID         NOT NULL,
  action        VARCHAR(50)  NOT NULL,
  actor_id      UUID,
  actor_email   VARCHAR(320),
  old_data      JSONB,
  new_data      JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_audit_entity ON survey_audit (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_survey_audit_actor  ON survey_audit (actor_id, created_at DESC);

-- -------------------------------------------------------
-- 12. survey_notification — notification log for survey events
-- -------------------------------------------------------
CREATE TABLE survey_notification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID         NOT NULL REFERENCES survey(id),
  recipient_id    UUID,
  recipient_email VARCHAR(320),
  event_type      VARCHAR(50)  NOT NULL CHECK (event_type IN (
    'survey_published','survey_closed','response_received',
    'response_limit_reached','invitation_sent','export_ready'
  )),
  channel         VARCHAR(20)  NOT NULL CHECK (channel IN ('email','sms','push','webhook')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  provider_ref    VARCHAR(200),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_notif_survey ON survey_notification (survey_id, event_type);
CREATE INDEX idx_survey_notif_recip  ON survey_notification (recipient_id);

-- -------------------------------------------------------
-- VIEWS
-- -------------------------------------------------------
CREATE VIEW v_survey_summary AS
SELECT
  s.id,
  s.slug,
  s.title,
  s.type,
  s.status,
  s.visibility,
  s.response_count,
  s.completion_count,
  CASE WHEN s.response_count = 0 THEN 0
       ELSE ROUND((s.completion_count::NUMERIC / s.response_count) * 100, 2)
  END AS completion_rate_pct,
  sa.nps_score,
  sa.average_time_seconds,
  COUNT(sq.id) AS question_count,
  s.published_at,
  s.closed_at
FROM survey s
LEFT JOIN survey_analytics sa ON sa.survey_id = s.id
LEFT JOIN survey_question sq ON sq.survey_id = s.id
GROUP BY s.id, sa.nps_score, sa.average_time_seconds;

CREATE VIEW v_nps_leaderboard AS
SELECT
  s.id,
  s.title,
  sa.nps_score,
  sa.total_responses,
  sa.completed_responses,
  CASE
    WHEN sa.nps_score >= 70 THEN 'excellent'
    WHEN sa.nps_score >= 30 THEN 'good'
    WHEN sa.nps_score >= 0  THEN 'needs_improvement'
    WHEN sa.nps_score IS NULL THEN 'no_data'
    ELSE 'critical'
  END AS nps_category
FROM survey s
JOIN survey_analytics sa ON sa.survey_id = s.id
WHERE s.type = 'nps'
ORDER BY sa.nps_score DESC NULLS LAST;

CREATE VIEW v_response_funnel AS
SELECT
  s.id AS survey_id,
  s.title,
  COUNT(sr.id) AS total_started,
  COUNT(sr.id) FILTER (WHERE sr.status = 'submitted')           AS completed,
  COUNT(sr.id) FILTER (WHERE sr.status = 'partial')             AS partial,
  COUNT(sr.id) FILTER (WHERE sr.status = 'in_progress')         AS in_progress,
  ROUND(AVG(sr.completion_percent), 2)                          AS avg_completion_pct,
  ROUND(AVG(sr.time_spent_seconds) / 60.0, 1)                  AS avg_minutes
FROM survey s
LEFT JOIN survey_response sr ON sr.survey_id = s.id
GROUP BY s.id, s.title;
