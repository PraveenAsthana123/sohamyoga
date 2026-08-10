-- Fixes two pre-existing broken jobs found while wiring the admin CRM page:
-- LeadNurturingJob.ts UPDATEs campaign_lead.lead_score/lead_temperature/
-- mautic_contact_id, and ChurnPredictionJob.ts INSERTs INTO churn_prediction —
-- neither existed in any tracked schema file, so both jobs would fail with
-- "column/relation does not exist" every time the cron worker ran them.

ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS lead_score INTEGER CHECK (lead_score BETWEEN 0 AND 100);
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS lead_temperature VARCHAR(10) CHECK (lead_temperature IN ('cold','warm','hot'));
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS mautic_contact_id VARCHAR(50);

CREATE TABLE IF NOT EXISTS churn_prediction (
  student_id        UUID         PRIMARY KEY,
  tenant_id         UUID         NOT NULL,
  predicted_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  risk_score        INTEGER      NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level        VARCHAR(10)  NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  top_reason        TEXT         NOT NULL,
  suggested_action  TEXT         NOT NULL,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_churn_prediction_tenant ON churn_prediction(tenant_id, risk_level);

COMMENT ON TABLE churn_prediction IS
  'Ollama-scored churn risk per member, advisory only — never triggers auto-cancellation.';
