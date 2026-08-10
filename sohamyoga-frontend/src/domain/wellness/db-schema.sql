-- Wave 17: Health & Wellness — PostgreSQL Schema
-- Tables: health_profile, body_metrics, daily_wellness_log, wearable_sync, wellness_audit
-- Views: v_wellness_summary, v_daily_completeness, v_bmi_distribution
-- Every table carries tenant_id for row-level multi-tenancy (see db-foundation.sql)

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE health_condition   AS ENUM ('diabetes','hypertension','asthma','arthritis','heart_disease','osteoporosis','anxiety','depression','migraine','chronic_pain');
CREATE TYPE allergy_type       AS ENUM ('latex','dust','pollen','nuts','dairy','gluten','fragrance','mold');
CREATE TYPE injury_area        AS ENUM ('neck','shoulder','upper_back','lower_back','hip','knee','ankle','wrist','elbow','hamstring');
CREATE TYPE fitness_level      AS ENUM ('sedentary','light','moderate','active','very_active');
CREATE TYPE wearable_platform  AS ENUM ('fitbit','garmin','apple_health','google_fit','samsung_health','polar');
CREATE TYPE wearable_status    AS ENUM ('connected','disconnected','syncing','error','pending_auth');

-- ─────────────────────────────────────────────
-- 1. health_profile
-- ─────────────────────────────────────────────

CREATE TABLE health_profile (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID           NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  customer_id      TEXT           NOT NULL,
  conditions       health_condition[] NOT NULL DEFAULT '{}',
  allergies        allergy_type[] NOT NULL DEFAULT '{}',
  injuries         injury_area[]  NOT NULL DEFAULT '{}',
  pain_areas       JSONB          NOT NULL DEFAULT '[]',   -- [{area, level, notes?}]
  medications      TEXT[]         NOT NULL DEFAULT '{}',
  pregnancy_mode   BOOLEAN        NOT NULL DEFAULT FALSE,
  pregnancy_week   SMALLINT       CHECK (pregnancy_week BETWEEN 1 AND 42),
  senior_mode      BOOLEAN        NOT NULL DEFAULT FALSE,
  kids_mode        BOOLEAN        NOT NULL DEFAULT FALSE,
  fitness_level    fitness_level  NOT NULL DEFAULT 'moderate',
  doctor_clearance BOOLEAN        NOT NULL DEFAULT FALSE,
  doctor_notes     TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, customer_id),   -- one profile per customer per tenant

  CONSTRAINT hp_pregnancy_week_requires_mode CHECK (
    pregnancy_week IS NULL OR pregnancy_mode = TRUE
  ),
  CONSTRAINT hp_pregnancy_mode_requires_week CHECK (
    pregnancy_mode = FALSE OR pregnancy_week IS NOT NULL
  ),
  CONSTRAINT hp_senior_kids_exclusive CHECK (
    NOT (senior_mode = TRUE AND kids_mode = TRUE)
  )
);

CREATE INDEX idx_hp_tenant      ON health_profile (tenant_id);
CREATE INDEX idx_hp_customer    ON health_profile (tenant_id, customer_id);
CREATE INDEX idx_hp_fitness     ON health_profile (tenant_id, fitness_level);
CREATE INDEX idx_hp_pregnancy   ON health_profile (tenant_id) WHERE pregnancy_mode = TRUE;
CREATE INDEX idx_hp_clearance   ON health_profile (tenant_id, doctor_clearance);

-- ─────────────────────────────────────────────
-- 2. body_metrics (history — multiple per customer)
-- ─────────────────────────────────────────────

CREATE TABLE body_metrics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  customer_id  TEXT        NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL,
  weight_kg    NUMERIC     NOT NULL CHECK (weight_kg > 0),
  height_cm    NUMERIC     NOT NULL CHECK (height_cm > 0),
  bmi          NUMERIC     GENERATED ALWAYS AS (
                 ROUND(weight_kg / POWER(height_cm / 100.0, 2), 1)
               ) STORED,
  chest_cm     NUMERIC     CHECK (chest_cm  > 0),
  waist_cm     NUMERIC     CHECK (waist_cm  > 0),
  hips_cm      NUMERIC     CHECK (hips_cm   > 0),
  thighs_cm    NUMERIC     CHECK (thighs_cm > 0),
  arms_cm      NUMERIC     CHECK (arms_cm   > 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bm_tenant      ON body_metrics (tenant_id);
CREATE INDEX idx_bm_customer    ON body_metrics (tenant_id, customer_id, recorded_at DESC);
CREATE INDEX idx_bm_bmi         ON body_metrics (tenant_id, bmi);
CREATE INDEX idx_bm_recorded    ON body_metrics (recorded_at DESC);

-- ─────────────────────────────────────────────
-- 3. daily_wellness_log (one per tenant+customer+date)
-- ─────────────────────────────────────────────

CREATE TABLE daily_wellness_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  customer_id     TEXT        NOT NULL,
  date            DATE        NOT NULL,
  sleep_hours     NUMERIC     CHECK (sleep_hours   BETWEEN 0  AND 24),
  water_ml        INTEGER     CHECK (water_ml       >= 0),
  calorie_burn    INTEGER     CHECK (calorie_burn   >= 0),
  steps           INTEGER     CHECK (steps          >= 0),
  heart_rate_bpm  SMALLINT    CHECK (heart_rate_bpm BETWEEN 20 AND 250),
  mood            SMALLINT    CHECK (mood            BETWEEN 1  AND 5),
  energy_level    SMALLINT    CHECK (energy_level    BETWEEN 1  AND 5),
  stress_level    SMALLINT    CHECK (stress_level    BETWEEN 1  AND 10),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, customer_id, date)  -- one log per customer per day
);

CREATE INDEX idx_dwl_tenant      ON daily_wellness_log (tenant_id);
CREATE INDEX idx_dwl_customer    ON daily_wellness_log (tenant_id, customer_id, date DESC);
CREATE INDEX idx_dwl_date        ON daily_wellness_log (tenant_id, date DESC);
CREATE INDEX idx_dwl_mood        ON daily_wellness_log (tenant_id, date, mood) WHERE mood IS NOT NULL;

-- ─────────────────────────────────────────────
-- 4. wearable_sync (one per tenant+customer+platform)
-- ─────────────────────────────────────────────

CREATE TABLE wearable_sync (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID              NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  customer_id      TEXT              NOT NULL,
  platform         wearable_platform NOT NULL,
  status           wearable_status   NOT NULL DEFAULT 'disconnected',
  device_name      TEXT,
  last_sync_at     TIMESTAMPTZ,
  next_sync_at     TIMESTAMPTZ,
  error_message    TEXT,
  connected_at     TIMESTAMPTZ,
  disconnected_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, customer_id, platform),   -- one sync record per platform per customer

  CONSTRAINT ws_connected_requires_connected_at CHECK (
    status <> 'connected' OR connected_at IS NOT NULL
  ),
  CONSTRAINT ws_error_requires_message CHECK (
    status <> 'error' OR error_message IS NOT NULL
  ),
  CONSTRAINT ws_disconnected_at_requires_connected_at CHECK (
    disconnected_at IS NULL OR connected_at IS NOT NULL
  ),
  CONSTRAINT ws_next_sync_after_last CHECK (
    next_sync_at IS NULL OR last_sync_at IS NULL OR next_sync_at > last_sync_at
  )
);

CREATE INDEX idx_ws_tenant      ON wearable_sync (tenant_id);
CREATE INDEX idx_ws_customer    ON wearable_sync (tenant_id, customer_id);
CREATE INDEX idx_ws_platform    ON wearable_sync (tenant_id, platform);
CREATE INDEX idx_ws_connected   ON wearable_sync (tenant_id) WHERE status = 'connected';

-- ─────────────────────────────────────────────
-- 5. wearable_data_point (raw metrics from devices)
-- ─────────────────────────────────────────────

CREATE TABLE wearable_data_point (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID  NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  sync_id      UUID  NOT NULL REFERENCES wearable_sync (id) ON DELETE CASCADE,
  customer_id  TEXT  NOT NULL,
  platform     wearable_platform NOT NULL,
  metric       TEXT  NOT NULL,     -- 'steps', 'heart_rate', 'sleep_minutes', 'calories_burned', 'stress_score'
  value        NUMERIC NOT NULL,
  unit         TEXT  NOT NULL,     -- 'count', 'bpm', 'minutes', 'kcal', 'score'
  recorded_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wdp_sync       ON wearable_data_point (sync_id, metric, recorded_at DESC);
CREATE INDEX idx_wdp_customer   ON wearable_data_point (tenant_id, customer_id, metric, recorded_at DESC);
CREATE INDEX idx_wdp_metric     ON wearable_data_point (tenant_id, metric, recorded_at DESC);

-- ─────────────────────────────────────────────
-- 6. wellness_audit (HIPAA/PIPEDA mandatory trail)
-- ─────────────────────────────────────────────

CREATE TABLE wellness_audit (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,  -- 'health_profile_accessed', 'health_data_exported', 'health_profile_deleted'
  actor        TEXT        NOT NULL,  -- staff userId or 'system'
  customer_id  TEXT,
  profile_id   UUID        REFERENCES health_profile (id),
  legal_basis  TEXT,                  -- GDPR Art.9 / PIPEDA basis for sensitive health data access
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_tenant   ON wellness_audit (tenant_id);
CREATE INDEX idx_wa_action   ON wellness_audit (action);
CREATE INDEX idx_wa_actor    ON wellness_audit (actor);
CREATE INDEX idx_wa_created  ON wellness_audit (created_at DESC);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_wellness_summary AS
SELECT
  hp.tenant_id,
  hp.customer_id,
  hp.fitness_level,
  hp.pregnancy_mode,
  hp.senior_mode,
  hp.kids_mode,
  hp.doctor_clearance,
  array_length(hp.conditions, 1)  AS condition_count,
  array_length(hp.allergies,  1)  AS allergy_count,
  array_length(hp.injuries,   1)  AS injury_count,
  array_length(hp.medications,1)  AS medication_count,
  bm_latest.weight_kg,
  bm_latest.height_cm,
  bm_latest.bmi,
  dwl_latest.date                 AS last_log_date,
  dwl_latest.mood                 AS last_mood,
  dwl_latest.energy_level         AS last_energy,
  dwl_latest.stress_level         AS last_stress,
  COUNT(DISTINCT ws.id) FILTER (WHERE ws.status = 'connected') AS wearables_connected
FROM health_profile hp
LEFT JOIN LATERAL (
  SELECT weight_kg, height_cm, bmi
  FROM body_metrics
  WHERE tenant_id = hp.tenant_id AND customer_id = hp.customer_id
  ORDER BY recorded_at DESC
  LIMIT 1
) bm_latest ON TRUE
LEFT JOIN LATERAL (
  SELECT date, mood, energy_level, stress_level
  FROM daily_wellness_log
  WHERE tenant_id = hp.tenant_id AND customer_id = hp.customer_id
  ORDER BY date DESC
  LIMIT 1
) dwl_latest ON TRUE
LEFT JOIN wearable_sync ws ON ws.tenant_id = hp.tenant_id AND ws.customer_id = hp.customer_id
GROUP BY hp.tenant_id, hp.customer_id, hp.fitness_level, hp.pregnancy_mode, hp.senior_mode,
         hp.kids_mode, hp.doctor_clearance, hp.conditions, hp.allergies, hp.injuries,
         hp.medications, bm_latest.weight_kg, bm_latest.height_cm, bm_latest.bmi,
         dwl_latest.date, dwl_latest.mood, dwl_latest.energy_level, dwl_latest.stress_level;

CREATE OR REPLACE VIEW v_daily_completeness AS
SELECT
  tenant_id,
  date,
  COUNT(*)                                                    AS total_logs,
  COUNT(*) FILTER (WHERE sleep_hours IS NOT NULL)            AS sleep_logged,
  COUNT(*) FILTER (WHERE water_ml    IS NOT NULL)            AS water_logged,
  COUNT(*) FILTER (WHERE mood        IS NOT NULL)            AS mood_logged,
  COUNT(*) FILTER (WHERE energy_level IS NOT NULL)           AS energy_logged,
  COUNT(*) FILTER (WHERE stress_level IS NOT NULL)           AS stress_logged,
  ROUND(AVG(mood)        FILTER (WHERE mood IS NOT NULL),1)  AS avg_mood,
  ROUND(AVG(energy_level)FILTER (WHERE energy_level IS NOT NULL),1) AS avg_energy,
  ROUND(AVG(stress_level)FILTER (WHERE stress_level IS NOT NULL),1) AS avg_stress,
  ROUND(AVG(sleep_hours) FILTER (WHERE sleep_hours IS NOT NULL),1)  AS avg_sleep_hours
FROM daily_wellness_log
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, date
ORDER BY tenant_id, date DESC;

CREATE OR REPLACE VIEW v_bmi_distribution AS
SELECT
  tenant_id,
  CASE
    WHEN bmi < 18.5  THEN 'underweight'
    WHEN bmi < 25    THEN 'normal'
    WHEN bmi < 30    THEN 'overweight'
    ELSE                  'obese'
  END                      AS bmi_category,
  COUNT(*)                 AS customer_count,
  ROUND(AVG(bmi),1)        AS avg_bmi,
  ROUND(MIN(bmi),1)        AS min_bmi,
  ROUND(MAX(bmi),1)        AS max_bmi
FROM (
  SELECT DISTINCT ON (tenant_id, customer_id)
    tenant_id, customer_id, bmi
  FROM body_metrics
  ORDER BY tenant_id, customer_id, recorded_at DESC
) latest_bmi
WHERE bmi IS NOT NULL
GROUP BY tenant_id, bmi_category
ORDER BY tenant_id, bmi_category;

-- ─────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['health_profile','body_metrics','daily_wellness_log','wearable_sync'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
