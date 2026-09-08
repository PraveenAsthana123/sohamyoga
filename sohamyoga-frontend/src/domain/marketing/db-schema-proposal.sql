-- Proposal Management -- "proposal" previously existed only as a funnel_stage
-- string literal on campaign_lead, with no real entity behind it. This is a
-- real, minimal proposal lifecycle: draft -> sent -> accepted/rejected/expired,
-- linked to the real campaign_lead it was written for. Closes the CRM & Sales
-- Management gap and is mandatory groundwork for running an agency business
-- (agencies sell via proposals, not checkout carts).
CREATE TABLE IF NOT EXISTS proposal (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  lead_id       UUID          NOT NULL REFERENCES campaign_lead(id) ON DELETE CASCADE,
  title         VARCHAR(200)  NOT NULL,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency      CHAR(3)       NOT NULL DEFAULT 'CAD',
  status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  valid_until   DATE,
  notes         TEXT,
  created_by    VARCHAR(120)  NOT NULL,
  sent_at       TIMESTAMPTZ,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_tenant ON proposal (tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposal_lead   ON proposal (lead_id);
CREATE INDEX IF NOT EXISTS idx_proposal_status ON proposal (status);
