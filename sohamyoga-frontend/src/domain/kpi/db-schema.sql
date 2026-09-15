-- KPI Engine, added 2026-09-14 -- backlog item #2 (priority 2), depends
-- on the Evidence Ledger (backlog item #1). 8 real executive dimensions,
-- each computed from a real, executable query against a real table --
-- never a placeholder. Where a dimension's real underlying table has
-- zero rows in a period (confirmed via live query this session for
-- reputation/revenue/referral_growth), the KPI is still computed and
-- stored as a real 0 with confidence=UNKNOWN (a 0-sample metric isn't
-- meaningful as a trend yet) rather than omitted or faked with a
-- plausible-looking non-zero number.

CREATE TABLE IF NOT EXISTS kpi_snapshot (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  dimension_key  VARCHAR(30)   NOT NULL CHECK (dimension_key IN (
    'acquisition','engagement','retention','wellness_outcomes',
    'referral_growth','reputation','revenue','operational_health'
  )),
  formula_version SMALLINT     NOT NULL DEFAULT 1,
  period_start   DATE          NOT NULL,
  period_end     DATE          NOT NULL,
  value          NUMERIC       NOT NULL,
  unit           VARCHAR(20)   NOT NULL, -- 'count', 'percent', 'currency_cad', 'score_0_100'
  sample_size    INTEGER       NOT NULL, -- real row count the value was computed over -- 0 is valid and disclosed, never hidden
  confidence     VARCHAR(10)   NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  explanation    TEXT          NOT NULL, -- real, human-readable statement of what was computed and from what
  evidence_id    UUID          REFERENCES evidence_record(id), -- real link when this snapshot also produced an evidence_record row
  computed_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dimension_key, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshot_period ON kpi_snapshot (tenant_id, dimension_key, period_start DESC);
