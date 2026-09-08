-- Opportunity -- the missing link between Lead and Proposal in a real CRM
-- pipeline. A lead becomes an opportunity once it's genuinely qualified
-- (real sales judgment call, not automatic); an opportunity can then have
-- a proposal (migration 137) created against it once terms are ready.
-- estimated_value/probability are admin-entered judgment, never fabricated
-- by AI -- ai_note (added separately) is advisory text only, never a
-- silently-applied score.
CREATE TABLE IF NOT EXISTS opportunity (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  lead_id           UUID          NOT NULL REFERENCES campaign_lead(id) ON DELETE CASCADE,
  title             VARCHAR(200)  NOT NULL,
  estimated_value   NUMERIC(10,2) NOT NULL CHECK (estimated_value >= 0),
  currency          CHAR(3)       NOT NULL DEFAULT 'CAD',
  stage             VARCHAR(20)   NOT NULL DEFAULT 'qualification'
                      CHECK (stage IN ('qualification','needs_analysis','proposal','negotiation','closed_won','closed_lost')),
  probability_pct   SMALLINT      CHECK (probability_pct BETWEEN 0 AND 100),
  expected_close_date DATE,
  lost_reason       TEXT,
  notes             TEXT,
  created_by        VARCHAR(120)  NOT NULL,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_tenant ON opportunity (tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_lead   ON opportunity (lead_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stage  ON opportunity (stage);
