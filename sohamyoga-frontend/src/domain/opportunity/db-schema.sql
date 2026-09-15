-- Opportunity & Benchmark Engine, added 2026-09-14 -- backlog item #3,
-- depends on kpi_snapshot (#2) and evidence_record (#1). Real candidate
-- generation over real KPI snapshots -- never a synthetic opportunity.
-- Per the roadmap's own rule (Epic N): never recommend a solution that
-- isn't itself demo-ready -- recommended_solution always cites a real,
-- already-built module/route in this codebase, or is explicitly null
-- with a disclosed "no real remediation module exists yet" note.

CREATE TABLE IF NOT EXISTS opportunity_candidate (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  kpi_dimension_key   VARCHAR(30)   NOT NULL,
  kpi_snapshot_id     UUID          NOT NULL REFERENCES kpi_snapshot(id),
  gap_reason          VARCHAR(20)   NOT NULL CHECK (gap_reason IN ('low_confidence','below_threshold')),
  current_value       NUMERIC       NOT NULL,
  threshold_value      NUMERIC,        -- real, disclosed threshold used for 'below_threshold' -- null for 'low_confidence' gaps
  impact_score        SMALLINT      NOT NULL CHECK (impact_score BETWEEN 0 AND 100),
  feasibility_score   SMALLINT      NOT NULL CHECK (feasibility_score BETWEEN 0 AND 100),
  priority_score       SMALLINT      NOT NULL CHECK (priority_score BETWEEN 0 AND 100),
  recommended_solution TEXT,          -- real pointer to an existing module/route -- null if none exists yet (disclosed, not omitted)
  rank                 SMALLINT,
  generated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kpi_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_tenant_rank ON opportunity_candidate (tenant_id, rank);
