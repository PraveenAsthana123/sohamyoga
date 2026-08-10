-- Wave 14: B2C Chat Module — PostgreSQL Schema
-- Stack: Chatwoot (customer messaging), Open WebUI + Ollama (AI),
--        LangGraph (workflow), LlamaIndex + Qdrant (RAG), LiveKit (voice/video)
-- Tables: chat_conversation, chat_message, chat_agent, chat_bot,
--         chat_handoff, chat_knowledge_base, chat_notification, chat_audit
-- Views: v_conversation_summary, v_agent_stats, v_chat_volume

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE conversation_status   AS ENUM ('open', 'pending', 'resolved', 'snoozed');
CREATE TYPE chat_channel          AS ENUM ('web', 'whatsapp', 'telegram', 'email', 'voice', 'video', 'sms');
CREATE TYPE conversation_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE sender_type           AS ENUM ('customer', 'agent', 'bot', 'system');
CREATE TYPE message_type          AS ENUM ('text', 'image', 'file', 'voice', 'video', 'emoji_reaction', 'system_event');
CREATE TYPE agent_status          AS ENUM ('online', 'offline', 'busy', 'away');
CREATE TYPE agent_role            AS ENUM ('agent', 'supervisor', 'admin');
CREATE TYPE bot_type              AS ENUM ('rule_based', 'llm', 'rag', 'hybrid');
CREATE TYPE bot_status            AS ENUM ('active', 'inactive', 'training');

-- ─────────────────────────────────────────────
-- 1. chat_agent
-- ─────────────────────────────────────────────

CREATE TABLE chat_agent (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT         NOT NULL UNIQUE,
  display_name             TEXT         NOT NULL CHECK (display_name <> ''),
  role                     agent_role   NOT NULL DEFAULT 'agent',
  status                   agent_status NOT NULL DEFAULT 'offline',
  max_concurrent_chats     INTEGER      NOT NULL DEFAULT 3 CHECK (max_concurrent_chats >= 1),
  skill_tags               TEXT[]       NOT NULL DEFAULT '{}',
  avg_response_time_secs   INTEGER      CHECK (avg_response_time_secs >= 0),
  satisfaction_score       SMALLINT     CHECK (satisfaction_score BETWEEN 0 AND 100),
  shift_start              TIME,
  shift_end                TIME,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_status ON chat_agent (status);
CREATE INDEX idx_agent_role   ON chat_agent (role);

-- ─────────────────────────────────────────────
-- 2. chat_bot
-- ─────────────────────────────────────────────

CREATE TABLE chat_bot (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL CHECK (name <> ''),
  bot_type              bot_type    NOT NULL,
  status                bot_status  NOT NULL DEFAULT 'inactive',
  model                 TEXT,
  system_prompt         TEXT        NOT NULL CHECK (system_prompt <> ''),
  knowledge_base_id     UUID,       -- FK to chat_knowledge_base
  handoff_triggers      TEXT[]      NOT NULL DEFAULT '{}',
  fallback_agent_id     UUID        REFERENCES chat_agent (id),
  max_turns             INTEGER     NOT NULL DEFAULT 20 CHECK (max_turns >= 1),
  temperature           NUMERIC(3,2) NOT NULL DEFAULT 0.70 CHECK (temperature BETWEEN 0 AND 1),
  response_timeout_ms   INTEGER     NOT NULL DEFAULT 5000 CHECK (response_timeout_ms >= 100),
  confidence_threshold  NUMERIC(3,2) NOT NULL DEFAULT 0.60 CHECK (confidence_threshold BETWEEN 0 AND 1),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_status ON chat_bot (status);

-- ─────────────────────────────────────────────
-- 3. chat_knowledge_base
-- ─────────────────────────────────────────────

CREATE TABLE chat_knowledge_base (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (name <> ''),
  description  TEXT,
  source_type  TEXT        NOT NULL DEFAULT 'manual',  -- 'manual', 'url_crawl', 'file_upload'
  document_count INTEGER   NOT NULL DEFAULT 0 CHECK (document_count >= 0),
  qdrant_collection TEXT,   -- linked Qdrant vector collection name
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_bot ADD CONSTRAINT fk_bot_knowledge_base
  FOREIGN KEY (knowledge_base_id) REFERENCES chat_knowledge_base (id);

-- ─────────────────────────────────────────────
-- 4. chat_conversation
-- ─────────────────────────────────────────────

CREATE TABLE chat_conversation (
  id                    UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           TEXT                  NOT NULL,
  channel               chat_channel          NOT NULL,
  status                conversation_status   NOT NULL DEFAULT 'pending',
  priority              conversation_priority NOT NULL DEFAULT 'normal',
  subject               TEXT,
  assigned_agent_id     UUID                  REFERENCES chat_agent (id),
  assigned_bot_id       UUID                  REFERENCES chat_bot (id),
  tags                  TEXT[]                NOT NULL DEFAULT '{}',
  message_count         INTEGER               NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  last_activity_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),
  opened_at             TIMESTAMPTZ           NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ,
  snooze_until          TIMESTAMPTZ,
  satisfaction_score    SMALLINT              CHECK (satisfaction_score BETWEEN 1 AND 5),
  satisfaction_feedback TEXT,
  created_at            TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ           NOT NULL DEFAULT now(),

  CONSTRAINT conv_resolved_has_date CHECK (
    status <> 'resolved' OR resolved_at IS NOT NULL
  ),
  CONSTRAINT conv_snoozed_has_date CHECK (
    status <> 'snoozed' OR snooze_until IS NOT NULL
  ),
  CONSTRAINT conv_snooze_after_open CHECK (
    snooze_until IS NULL OR snooze_until > opened_at
  ),
  CONSTRAINT conv_satisfaction_on_resolved CHECK (
    satisfaction_score IS NULL OR status = 'resolved'
  )
);

CREATE INDEX idx_conv_status         ON chat_conversation (status);
CREATE INDEX idx_conv_customer       ON chat_conversation (customer_id);
CREATE INDEX idx_conv_agent          ON chat_conversation (assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX idx_conv_channel        ON chat_conversation (channel);
CREATE INDEX idx_conv_priority       ON chat_conversation (priority);
CREATE INDEX idx_conv_last_activity  ON chat_conversation (last_activity_at DESC);

-- ─────────────────────────────────────────────
-- 5. chat_message
-- ─────────────────────────────────────────────

CREATE TABLE chat_message (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID         NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
  sender_id        TEXT         NOT NULL,
  sender_type      sender_type  NOT NULL,
  message_type     message_type NOT NULL DEFAULT 'text',
  content          TEXT         NOT NULL DEFAULT '',
  attachments      JSONB        NOT NULL DEFAULT '[]',
  is_private       BOOLEAN      NOT NULL DEFAULT FALSE,
  parent_message_id UUID        REFERENCES chat_message (id),
  reactions        JSONB        NOT NULL DEFAULT '{}',  -- {"❤️": ["cust-1", "ag-1"]}
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  edited_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT msg_text_not_empty CHECK (
    message_type <> 'text' OR trim(content) <> ''
  ),
  CONSTRAINT msg_private_agent_only CHECK (
    is_private = FALSE OR sender_type = 'agent'
  ),
  CONSTRAINT msg_read_after_delivered CHECK (
    read_at IS NULL OR delivered_at IS NOT NULL
  ),
  CONSTRAINT msg_delivered_after_created CHECK (
    delivered_at IS NULL OR delivered_at >= created_at
  )
);

CREATE INDEX idx_msg_conversation ON chat_message (conversation_id, created_at DESC);
CREATE INDEX idx_msg_sender       ON chat_message (sender_id);
CREATE INDEX idx_msg_type         ON chat_message (message_type);
-- Private (agent notes) messages indexed separately
CREATE INDEX idx_msg_private ON chat_message (conversation_id) WHERE is_private = TRUE;

-- ─────────────────────────────────────────────
-- 6. chat_handoff
-- ─────────────────────────────────────────────

CREATE TABLE chat_handoff (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
  from_bot_id     UUID        REFERENCES chat_bot (id),
  to_agent_id     UUID        REFERENCES chat_agent (id),
  reason          TEXT        NOT NULL,   -- 'low_confidence', 'keyword_trigger', 'customer_request', 'timeout'
  confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  trigger_phrase  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_handoff_conv  ON chat_handoff (conversation_id);
CREATE INDEX idx_handoff_agent ON chat_handoff (to_agent_id);

-- ─────────────────────────────────────────────
-- 7. chat_notification
-- ─────────────────────────────────────────────

CREATE TABLE chat_notification (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        REFERENCES chat_conversation (id) ON DELETE CASCADE,
  recipient_id    TEXT        NOT NULL,    -- userId or email
  channel         TEXT        NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'telegram', 'whatsapp')),
  subject         TEXT,
  body            TEXT        NOT NULL CHECK (body <> ''),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_conversation ON chat_notification (conversation_id);
CREATE INDEX idx_notif_recipient    ON chat_notification (recipient_id);
CREATE INDEX idx_notif_channel      ON chat_notification (channel);

-- ─────────────────────────────────────────────
-- 8. chat_audit
-- ─────────────────────────────────────────────

CREATE TABLE chat_audit (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT        NOT NULL,   -- 'pii_accessed', 'conversation_exported', 'data_deleted', 'bot_config_changed'
  actor           TEXT        NOT NULL,   -- staff userId
  conversation_id UUID        REFERENCES chat_conversation (id),
  subject_id      TEXT,                   -- customerId or conversationId targeted
  legal_basis     TEXT,                   -- GDPR/PIPEDA basis
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_audit_action  ON chat_audit (action);
CREATE INDEX idx_chat_audit_actor   ON chat_audit (actor);
CREATE INDEX idx_chat_audit_created ON chat_audit (created_at DESC);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_conversation_summary AS
SELECT
  c.id,
  c.customer_id,
  c.channel,
  c.status,
  c.priority,
  c.assigned_agent_id,
  a.display_name            AS agent_name,
  c.message_count,
  c.last_activity_at,
  c.satisfaction_score,
  EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, now()) - c.opened_at)) / 60 AS duration_minutes
FROM chat_conversation c
LEFT JOIN chat_agent a ON a.id = c.assigned_agent_id;

CREATE OR REPLACE VIEW v_agent_stats AS
SELECT
  a.id,
  a.display_name,
  a.status,
  a.max_concurrent_chats,
  COUNT(c.id) FILTER (WHERE c.status IN ('open', 'pending')) AS active_conversations,
  a.avg_response_time_secs,
  a.satisfaction_score
FROM chat_agent a
LEFT JOIN chat_conversation c ON c.assigned_agent_id = a.id
GROUP BY a.id;

CREATE OR REPLACE VIEW v_chat_volume AS
SELECT
  DATE(created_at)      AS day,
  channel,
  COUNT(*)              AS conversations,
  COUNT(*) FILTER (WHERE status = 'resolved')  AS resolved,
  AVG(satisfaction_score) FILTER (WHERE satisfaction_score IS NOT NULL) AS avg_csat
FROM chat_conversation
GROUP BY DATE(created_at), channel
ORDER BY day DESC, conversations DESC;

-- ─────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['chat_agent', 'chat_bot', 'chat_conversation', 'chat_knowledge_base'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
