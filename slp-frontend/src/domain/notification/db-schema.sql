-- Notification & Communication Center DB schema
-- System of record for all notification state: templates, queue, delivery history,
-- preferences, analytics, suppression lists.
-- External providers (Novu, Listmonk, Postal, ntfy, Apprise) receive rendered
-- messages only — no customer profile data is stored externally.
-- All tables include tenant_id for multi-tenancy.

-- ── Reference tables ──────────────────────────────────────────────────────────

CREATE TABLE ref_notification_channel (
  code         VARCHAR(16) PRIMARY KEY,
  label        VARCHAR(64) NOT NULL,
  max_length   INTEGER,           -- character limit for SMS/WhatsApp (160 / 4096)
  is_visual    BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO ref_notification_channel (code, label, max_length) VALUES
  ('email',    'Email',                NULL),
  ('sms',      'SMS',                  160),
  ('whatsapp', 'WhatsApp',             4096),
  ('push',     'Push Notification',    NULL),
  ('in_app',   'In-App',               NULL),
  ('telegram', 'Telegram',             4096),
  ('discord',  'Discord',              2000),
  ('slack',    'Slack',                3000),
  ('voice',    'Voice / IVR',          NULL);

CREATE TABLE ref_notification_type (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_notification_type (code) VALUES
  ('transactional'), ('marketing'), ('reminder'), ('alert'), ('otp');

CREATE TABLE ref_notification_template_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_notification_template_status (code) VALUES
  ('draft'), ('approved'), ('active'), ('archived');

CREATE TABLE ref_notification_job_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_notification_job_status (code) VALUES
  ('pending'), ('scheduled'), ('processing'), ('sent'), ('failed'), ('cancelled');

-- ── Notification template ────────────────────────────────────────────────────

CREATE TABLE notification_template (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL,
  slug          VARCHAR(128)  NOT NULL,
  name          VARCHAR(256)  NOT NULL,
  channel       VARCHAR(16)   NOT NULL REFERENCES ref_notification_channel(code),
  type          VARCHAR(16)   NOT NULL REFERENCES ref_notification_type(code),
  subject       VARCHAR(512),                -- required for email
  body          TEXT          NOT NULL,
  variables     VARCHAR(64)[] NOT NULL DEFAULT '{}',
  locale        VARCHAR(8)    NOT NULL DEFAULT 'en',
  status        VARCHAR(16)   NOT NULL DEFAULT 'draft' REFERENCES ref_notification_template_status(code),
  version       SMALLINT      NOT NULL DEFAULT 1,
  approved_by   UUID,
  approved_at   TIMESTAMPTZ,
  created_by    UUID          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug, locale),
  CONSTRAINT chk_template_version   CHECK (version >= 1),
  CONSTRAINT chk_template_email_subj CHECK (channel != 'email' OR subject IS NOT NULL)
);

CREATE INDEX idx_template_tenant_status ON notification_template (tenant_id, status, channel);

-- Previous versions archive (kept for audit trail)
CREATE TABLE notification_template_version (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID         NOT NULL REFERENCES notification_template(id) ON DELETE CASCADE,
  version         SMALLINT     NOT NULL,
  body            TEXT         NOT NULL,
  subject         VARCHAR(512),
  archived_by     UUID         NOT NULL,
  archived_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version)
);

-- ── Notification queue / job ──────────────────────────────────────────────────

CREATE TABLE notification_queue (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  template_slug       VARCHAR(128) NOT NULL,
  channel             VARCHAR(16)  NOT NULL REFERENCES ref_notification_channel(code),
  type                VARCHAR(16)  NOT NULL REFERENCES ref_notification_type(code),
  recipient_user_id   UUID         NOT NULL,
  recipient_address   VARCHAR(512) NOT NULL,
  payload             JSONB        NOT NULL DEFAULT '{}',  -- variable values for template render
  status              VARCHAR(16)  NOT NULL DEFAULT 'pending' REFERENCES ref_notification_job_status(code),
  scheduled_at        TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  retry_count         SMALLINT     NOT NULL DEFAULT 0,
  last_retry_at       TIMESTAMPTZ,
  failure_reason      TEXT,
  idempotency_key     VARCHAR(256) NOT NULL,
  provider_message_id VARCHAR(256),                        -- returned by Novu/Listmonk/ntfy
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT chk_queue_retry_count CHECK (retry_count >= 0 AND retry_count <= 3)
);

CREATE INDEX idx_queue_pending    ON notification_queue (tenant_id, status, scheduled_at NULLS FIRST)
  WHERE status IN ('pending', 'scheduled');
CREATE INDEX idx_queue_recipient  ON notification_queue (tenant_id, recipient_user_id, created_at DESC);
CREATE INDEX idx_queue_idem       ON notification_queue (idempotency_key);

-- Jobs ready to process right now
CREATE VIEW v_notification_due AS
  SELECT *
  FROM notification_queue
  WHERE status = 'pending'
     OR (status = 'scheduled' AND scheduled_at <= NOW())
  ORDER BY scheduled_at NULLS FIRST, created_at;

-- ── Notification history ──────────────────────────────────────────────────────

CREATE TABLE notification_history (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  job_id              UUID         NOT NULL REFERENCES notification_queue(id),
  template_slug       VARCHAR(128) NOT NULL,
  channel             VARCHAR(16)  NOT NULL,
  type                VARCHAR(16)  NOT NULL,
  recipient_user_id   UUID         NOT NULL,
  recipient_address   VARCHAR(512) NOT NULL,
  status              VARCHAR(16)  NOT NULL,
  sent_at             TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,               -- email open tracking
  clicked_at          TIMESTAMPTZ,               -- email click tracking
  bounced_at          TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  provider_message_id VARCHAR(256),
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_recipient ON notification_history (tenant_id, recipient_user_id, sent_at DESC);
CREATE INDEX idx_history_template  ON notification_history (tenant_id, template_slug, sent_at DESC);
CREATE INDEX idx_history_channel   ON notification_history (tenant_id, channel, sent_at DESC);

-- ── Customer notification preferences ────────────────────────────────────────

CREATE TABLE notification_preference (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL,
  user_id               UUID        NOT NULL,
  email_enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  sms_enabled           BOOLEAN     NOT NULL DEFAULT FALSE,
  push_enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  whatsapp_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  in_app_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  telegram_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  marketing_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  transactional_enabled BOOLEAN     NOT NULL DEFAULT TRUE,  -- OTP, booking, payment
  reminder_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  alert_enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  language              VARCHAR(8)  NOT NULL DEFAULT 'en',
  quiet_hours_start     VARCHAR(5),                         -- HH:MM
  quiet_hours_end       VARCHAR(5),                         -- HH:MM
  timezone              VARCHAR(64) NOT NULL DEFAULT 'UTC',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id),
  CONSTRAINT chk_quiet_hours CHECK (
    (quiet_hours_start IS NULL AND quiet_hours_end IS NULL) OR
    (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
  )
);

CREATE INDEX idx_pref_tenant ON notification_preference (tenant_id);

-- ── Suppression list ─────────────────────────────────────────────────────────

CREATE TABLE suppression_list (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL,
  address       VARCHAR(512)  NOT NULL,   -- email or phone number (normalized)
  channel       VARCHAR(16)   NOT NULL REFERENCES ref_notification_channel(code),
  reason        VARCHAR(32)   NOT NULL,   -- 'unsubscribe', 'bounce', 'complaint', 'admin', 'do_not_contact'
  source_job_id UUID          REFERENCES notification_queue(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, address, channel)
);

CREATE INDEX idx_suppression ON suppression_list (tenant_id, address, channel);

-- ── Notification analytics (daily aggregation) ───────────────────────────────

CREATE TABLE notification_analytics (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL,
  report_date   DATE         NOT NULL,
  channel       VARCHAR(16)  NOT NULL REFERENCES ref_notification_channel(code),
  template_slug VARCHAR(128),
  type          VARCHAR(16),
  sent_count    INTEGER      NOT NULL DEFAULT 0,
  delivered     INTEGER      NOT NULL DEFAULT 0,
  failed        INTEGER      NOT NULL DEFAULT 0,
  bounced       INTEGER      NOT NULL DEFAULT 0,
  opened        INTEGER      NOT NULL DEFAULT 0,   -- email only
  clicked       INTEGER      NOT NULL DEFAULT 0,   -- email only
  unsubscribed  INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_notification_analytics_dimension
  ON notification_analytics
  (tenant_id, report_date, channel, COALESCE(template_slug, ''), COALESCE(type, ''));
CREATE INDEX idx_analytics_daily ON notification_analytics (tenant_id, report_date DESC, channel);

-- ── Views ─────────────────────────────────────────────────────────────────────

-- Channel health summary for the last 7 days
CREATE VIEW v_channel_health AS
  SELECT
    tenant_id,
    channel,
    SUM(sent_count)   AS sent_7d,
    SUM(delivered)    AS delivered_7d,
    SUM(failed)       AS failed_7d,
    SUM(bounced)      AS bounced_7d,
    ROUND(100.0 * SUM(delivered) / NULLIF(SUM(sent_count), 0), 1) AS delivery_rate_pct,
    ROUND(100.0 * SUM(opened)    / NULLIF(SUM(delivered), 0), 1)  AS open_rate_pct,
    ROUND(100.0 * SUM(clicked)   / NULLIF(SUM(opened), 0), 1)     AS click_rate_pct
  FROM notification_analytics
  WHERE report_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY tenant_id, channel;

-- Top templates by send volume this month
CREATE VIEW v_top_templates AS
  SELECT
    tenant_id,
    template_slug,
    channel,
    SUM(sent_count)  AS sent_30d,
    SUM(delivered)   AS delivered_30d,
    ROUND(100.0 * SUM(delivered) / NULLIF(SUM(sent_count), 0), 1) AS delivery_pct,
    ROUND(100.0 * SUM(opened)    / NULLIF(SUM(delivered), 0), 1)  AS open_pct
  FROM notification_analytics
  WHERE report_date >= CURRENT_DATE - INTERVAL '30 days'
    AND template_slug IS NOT NULL
  GROUP BY tenant_id, template_slug, channel
  ORDER BY sent_30d DESC;

-- Retry queue — failed jobs eligible for retry
CREATE VIEW v_retry_queue AS
  SELECT *
  FROM notification_queue
  WHERE status = 'failed'
    AND retry_count < 3
  ORDER BY created_at;
