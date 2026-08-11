-- Voice of Customer digest — weekly Ollama theme clustering over REAL inbound
-- customer text. Deliberately not "social listening" in the competitor/
-- public-mention-monitoring sense: no API for that exists anywhere in this
-- stack (Postiz manages only our own connected accounts — currently zero —
-- and has no public search capability regardless). Instead grounded in two
-- real, already-flowing sources: campaign_lead.message (real contact-form
-- submissions, wired this session) and sentiment_log (real comment/manual
-- sentiment classifications, built earlier this session).

CREATE TABLE IF NOT EXISTS voice_of_customer_digest (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL,
  period_start          DATE         NOT NULL,
  period_end            DATE         NOT NULL,
  source_message_count  INTEGER      NOT NULL CHECK (source_message_count >= 0),
  themes                JSONB        NOT NULL DEFAULT '[]',
  top_complaints        TEXT[]       NOT NULL DEFAULT '{}',
  top_requests          TEXT[]       NOT NULL DEFAULT '{}',
  overall_summary       TEXT         NOT NULL,
  report_text           TEXT         NOT NULL,
  status                VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'dismissed')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_voc_digest_period ON voice_of_customer_digest (tenant_id, period_start DESC);
