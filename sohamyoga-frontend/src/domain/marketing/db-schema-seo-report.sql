-- SeoReportJob has written to this table since it was built — the table
-- never existed ("relation seo_report does not exist" on every run,
-- confirmed live 2026-08-11). Draft only — requires staff review.

CREATE TABLE IF NOT EXISTS seo_report (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  report_date  DATE         NOT NULL UNIQUE,
  report_text  TEXT         NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'dismissed')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
