CREATE TABLE IF NOT EXISTS meeting_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID REFERENCES study(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('pre_meeting_brief','post_meeting_report')),
  title TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  meeting_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','archived')),
  objective TEXT NOT NULL DEFAULT '',
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_report_study ON meeting_report(study_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_report_customer ON meeting_report(lower(customer_name), created_at DESC);

CREATE TABLE IF NOT EXISTS meeting_report_event (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES meeting_report(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','updated','status_changed','export_requested')),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_report_event_report ON meeting_report_event(report_id, created_at DESC);
