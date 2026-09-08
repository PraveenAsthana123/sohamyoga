-- Contract Management -- a real, natural extension of the Proposal system
-- (migration 137): once a proposal is accepted, an agency needs a contract
-- with real terms and a signature status. No e-signature service (DocuSign/
-- HelloSign) is connected in this environment, so signing is a manual
-- admin-recorded action, not a fabricated e-signature integration.
CREATE TABLE IF NOT EXISTS contract (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  proposal_id   UUID          NOT NULL REFERENCES proposal(id) ON DELETE CASCADE,
  lead_id       UUID          NOT NULL REFERENCES campaign_lead(id) ON DELETE CASCADE,
  title         VARCHAR(200)  NOT NULL,
  terms         TEXT          NOT NULL,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency      CHAR(3)       NOT NULL DEFAULT 'CAD',
  status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','signed','void')),
  signed_by_name VARCHAR(200),
  sent_at       TIMESTAMPTZ,
  signed_at     TIMESTAMPTZ,
  voided_at     TIMESTAMPTZ,
  created_by    VARCHAR(120)  NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_tenant   ON contract (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contract_lead     ON contract (lead_id);
CREATE INDEX IF NOT EXISTS idx_contract_status   ON contract (status);
