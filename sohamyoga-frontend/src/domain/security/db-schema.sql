-- AI Control Tower: real security scanning registry (SAST/SCA/IaC/DAST).
-- Every row here comes from an actual tool run (npm audit, trivy, semgrep,
-- OWASP ZAP) shelled out server-side and parsed -- never a fabricated
-- finding. A category with no tool installed yet stays absent from
-- security_scan_run rather than getting a synthetic "clean" result.

CREATE TABLE IF NOT EXISTS security_scan_run (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  category       TEXT NOT NULL CHECK (category IN ('sast','sca','iac','dast')),
  tool           TEXT NOT NULL,                    -- 'npm_audit' | 'trivy_fs' | 'trivy_config' | 'semgrep' | 'zap_baseline'
  target         TEXT NOT NULL,                    -- 'sohamyoga-frontend' | 'market-research-portal' | 'sohamyoga-backend' | 'infra'
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  triggered_by   TEXT NOT NULL,                    -- admin email or 'cron:SecurityScanJob'
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  duration_ms    INTEGER,
  summary        JSONB NOT NULL DEFAULT '{}'::jsonb, -- {critical,high,medium,low,info} counts
  error_message  TEXT,
  raw_output     JSONB                              -- full parsed tool output, for drill-down
);

CREATE INDEX IF NOT EXISTS idx_scan_run_tenant   ON security_scan_run (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_run_category ON security_scan_run (category);
CREATE INDEX IF NOT EXISTS idx_scan_run_started  ON security_scan_run (started_at DESC);

CREATE TABLE IF NOT EXISTS security_finding (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id       UUID NOT NULL REFERENCES security_scan_run (id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  severity          TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  title             TEXT NOT NULL,
  description       TEXT,
  file_path         TEXT,
  line_number       INTEGER,
  package_name      TEXT,
  installed_version TEXT,
  fixed_version     TEXT,
  cve_id            TEXT,
  rule_id           TEXT,
  fingerprint       TEXT NOT NULL,                  -- stable hash for dedup across re-scans
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','fixed','false_positive')),
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       TEXT,

  UNIQUE (tenant_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_finding_tenant   ON security_finding (tenant_id);
CREATE INDEX IF NOT EXISTS idx_finding_run      ON security_finding (scan_run_id);
CREATE INDEX IF NOT EXISTS idx_finding_severity ON security_finding (severity);
CREATE INDEX IF NOT EXISTS idx_finding_status   ON security_finding (status);
