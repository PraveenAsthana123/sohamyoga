-- Evidence Ledger, added 2026-09-14 -- backlog item #1 (priority 1) from
-- the 2026-09-14 roadmap cross-check
-- (docs/chatgpt-extracts/2026-09-14_marketing-greeting-exchange-soham-roadmap.md).
-- The roadmap treats this classification model as its single most
-- important architectural spine (repeatedly re-specified across Phase 2-5,
-- Phase 84-87, and Epic I) -- confirmed absent from the codebase in 4
-- independent searches before this file was written.
--
-- Every real claim this platform surfaces (a theme, a KPI, an opportunity,
-- a competitor finding) should be traceable to a real evidence_record row
-- rather than asserted bare. evidence_type is the roadmap's own five-way
-- classification -- never collapsed to a single "confidence %" number.
-- subject_type/subject_id is a soft polymorphic reference (no FK, since it
-- points at different real tables depending on subject_type) so evidence
-- can attach to a business, a competitor, a customer segment, a product,
-- or any other real entity across the platform without a central "subject"
-- table existing first.

CREATE TABLE IF NOT EXISTS evidence_record (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  subject_type   VARCHAR(40)   NOT NULL, -- e.g. 'voice_of_customer', 'competitor', 'business', 'product' -- open vocabulary, not a fixed enum, since new subject types are added as more of the backlog gets wired in
  subject_id     UUID          NOT NULL, -- real id in whatever table subject_type names
  evidence_type  VARCHAR(12)   NOT NULL CHECK (evidence_type IN ('FACT','ESTIMATE','INFERENCE','HYPOTHESIS','UNKNOWN')),
  claim          TEXT          NOT NULL, -- the actual finding/statement, in plain language
  confidence     VARCHAR(10)   NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  source_type    VARCHAR(40)   NOT NULL, -- honest, real source classification -- e.g. 'ollama_inference', 'admin_entered', 'computed_aggregate', 'public_scan' -- never a source that wasn't actually used
  source_ref     TEXT          NOT NULL, -- real pointer back to the originating row/table (e.g. 'voice_of_customer_digest:<uuid>') or a real external URL -- required, not optional: this table's entire purpose is that every claim traces somewhere real
  collected_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  valid_until    TIMESTAMPTZ,             -- real freshness policy -- null means no known expiry, not "forever valid"
  superseded_by  UUID          REFERENCES evidence_record(id),
  created_by     TEXT,                    -- system/job name or admin user id -- free text since producers vary (jobs vs. admin actions)
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_subject ON evidence_record (tenant_id, subject_type, subject_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence_record (tenant_id, evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_stale ON evidence_record (tenant_id, valid_until) WHERE valid_until IS NOT NULL;
