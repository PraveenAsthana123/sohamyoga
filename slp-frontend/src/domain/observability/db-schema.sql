-- Canonical tenant-aware historical operations ledger.
-- Complements module-specific audit tables; does not replace them.

CREATE TABLE IF NOT EXISTS ref_operation_status (
  code VARCHAR(24) PRIMARY KEY,
  label VARCHAR(60) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  is_failure BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO ref_operation_status(code,label,is_terminal,is_failure) VALUES
 ('queued','Queued',FALSE,FALSE),('running','Running',FALSE,FALSE),
 ('succeeded','Succeeded',TRUE,FALSE),('failed','Failed',TRUE,TRUE),
 ('cancelled','Cancelled',TRUE,FALSE),('timeout','Timeout',TRUE,TRUE),
 ('blocked','Circuit Blocked',TRUE,TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_event_severity (
  code VARCHAR(12) PRIMARY KEY,
  rank SMALLINT NOT NULL UNIQUE CHECK(rank BETWEEN 1 AND 6)
);
INSERT INTO ref_event_severity(code,rank) VALUES
 ('trace',1),('debug',2),('info',3),('warning',4),('error',5),('critical',6)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_component (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  runtime VARCHAR(40) NOT NULL,
  component_type VARCHAR(40) NOT NULL,
  version VARCHAR(60),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_component(component_key,name,runtime,component_type) VALUES
 ('soham-next','SohamYoga Web','typescript','web'),
 ('soham-dotnet','SohamYoga API','dotnet','api'),
 ('ollama-director','Ollama Director','python','agent'),
 ('ollama-worker','Ollama Worker','python','worker'),
 ('openclaw','OpenClaw','node','agent'),
 ('paperclip','Paperclip','node','orchestrator'),
 ('slack-bridge','Slack Bridge','python','integration'),
 ('shell-launcher','Soham AI Launcher','shell','cli')
ON CONFLICT (component_key) DO UPDATE SET runtime=EXCLUDED.runtime, component_type=EXCLUDED.component_type;

CREATE TABLE IF NOT EXISTS ai_model_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(60) NOT NULL,
  model_name VARCHAR(160) NOT NULL,
  model_family VARCHAR(80),
  capability_codes TEXT[] NOT NULL DEFAULT '{}',
  context_length INTEGER CHECK(context_length IS NULL OR context_length > 0),
  local_model BOOLEAN NOT NULL DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider,model_name)
);

CREATE TABLE IF NOT EXISTS service_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organization(id) ON DELETE SET NULL,
  service_code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  duration_minutes INTEGER CHECK(duration_minutes IS NULL OR duration_minutes >= 0),
  base_price NUMERIC(14,2) CHECK(base_price IS NULL OR base_price >= 0),
  currency CHAR(3), tax_code VARCHAR(50), metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,service_code)
);

CREATE TABLE IF NOT EXISTS business_condition_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  condition_code VARCHAR(100) NOT NULL,
  condition_type VARCHAR(60) NOT NULL,
  name VARCHAR(200) NOT NULL,
  expression JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ, effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,condition_code), CHECK(effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS text_asset_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  asset_key VARCHAR(140) NOT NULL,
  asset_type VARCHAR(50) NOT NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'en',
  title TEXT, body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,asset_key,locale,version)
);

ALTER TABLE product_master ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE;
ALTER TABLE product_master ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organization(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_master_tenant ON product_master(tenant_id);

CREATE TABLE IF NOT EXISTS operation_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organization(id) ON DELETE SET NULL,
  component_id UUID NOT NULL REFERENCES platform_component(id),
  parent_run_id UUID REFERENCES operation_run(id) ON DELETE SET NULL,
  trace_id UUID NOT NULL DEFAULT gen_random_uuid(),
  correlation_id VARCHAR(160), operation_type VARCHAR(80) NOT NULL,
  operation_name VARCHAR(240) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued' REFERENCES ref_operation_status(code),
  actor_type VARCHAR(40), actor_id VARCHAR(160), source VARCHAR(80),
  request_summary TEXT, input_metadata JSONB NOT NULL DEFAULT '{}', output_metadata JSONB NOT NULL DEFAULT '{}',
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt > 0), duration_ms BIGINT CHECK(duration_ms IS NULL OR duration_ms >= 0),
  queued_at TIMESTAMPTZ, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operation_run_trace ON operation_run(trace_id);
CREATE INDEX IF NOT EXISTS idx_operation_run_tenant_status ON operation_run(tenant_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_run_component ON operation_run(component_id,created_at DESC);

CREATE TABLE IF NOT EXISTS operation_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES operation_run(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  severity VARCHAR(12) NOT NULL DEFAULT 'info' REFERENCES ref_event_severity(code),
  event_code VARCHAR(100) NOT NULL, stage VARCHAR(100), message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operation_event_run_time ON operation_event(run_id,occurred_at);
CREATE INDEX IF NOT EXISTS idx_operation_event_tenant_severity ON operation_event(tenant_id,severity,occurred_at DESC);

CREATE TABLE IF NOT EXISTS error_occurrence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES operation_run(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  component_id UUID NOT NULL REFERENCES platform_component(id),
  trace_id UUID NOT NULL, error_code VARCHAR(100) NOT NULL,
  error_type VARCHAR(200), message TEXT NOT NULL,
  sanitized_stack TEXT, fingerprint VARCHAR(128), severity VARCHAR(12) NOT NULL DEFAULT 'error' REFERENCES ref_event_severity(code),
  retryable BOOLEAN NOT NULL DEFAULT FALSE, resolved BOOLEAN NOT NULL DEFAULT FALSE,
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK(occurrence_count > 0),
  context JSONB NOT NULL DEFAULT '{}', first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ,
  UNIQUE(component_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_error_open ON error_occurrence(tenant_id,last_seen_at DESC) WHERE resolved=FALSE;

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES platform_component(id),
  circuit_key VARCHAR(160) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'closed' CHECK(state IN ('closed','open','half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK(failure_count >= 0),
  success_count INTEGER NOT NULL DEFAULT 0 CHECK(success_count >= 0),
  failure_threshold INTEGER NOT NULL DEFAULT 5 CHECK(failure_threshold > 0),
  recovery_timeout_seconds INTEGER NOT NULL DEFAULT 60 CHECK(recovery_timeout_seconds > 0),
  opened_at TIMESTAMPTZ, next_attempt_at TIMESTAMPTZ, last_failure_at TIMESTAMPTZ, last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT(tenant_id,component_id,circuit_key)
);

CREATE TABLE IF NOT EXISTS circuit_breaker_transition (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  circuit_id UUID NOT NULL REFERENCES circuit_breaker_state(id) ON DELETE CASCADE,
  run_id UUID REFERENCES operation_run(id) ON DELETE SET NULL,
  from_state VARCHAR(16), to_state VARCHAR(16) NOT NULL,
  reason TEXT, failure_count INTEGER NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_invocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES operation_run(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  model_id UUID NOT NULL REFERENCES ai_model_master(id),
  purpose VARCHAR(80), prompt_hash VARCHAR(128), prompt_chars INTEGER CHECK(prompt_chars IS NULL OR prompt_chars >= 0),
  input_tokens INTEGER CHECK(input_tokens IS NULL OR input_tokens >= 0), output_tokens INTEGER CHECK(output_tokens IS NULL OR output_tokens >= 0),
  latency_ms BIGINT CHECK(latency_ms IS NULL OR latency_ms >= 0), load_ms BIGINT CHECK(load_ms IS NULL OR load_ms >= 0),
  status VARCHAR(24) NOT NULL REFERENCES ref_operation_status(code), quality_score NUMERIC(5,2),
  error_id UUID REFERENCES error_occurrence(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_invocation_model_time ON model_invocation(model_id,created_at DESC);

CREATE TABLE IF NOT EXISTS integration_call (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES operation_run(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  provider VARCHAR(100) NOT NULL, operation VARCHAR(160) NOT NULL,
  endpoint_host VARCHAR(255), method VARCHAR(12), response_status INTEGER,
  status VARCHAR(24) NOT NULL REFERENCES ref_operation_status(code),
  attempt INTEGER NOT NULL DEFAULT 1, duration_ms BIGINT,
  circuit_id UUID REFERENCES circuit_breaker_state(id) ON DELETE SET NULL,
  error_id UUID REFERENCES error_occurrence(id) ON DELETE SET NULL,
  request_metadata JSONB NOT NULL DEFAULT '{}', response_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integration_call_provider_time ON integration_call(tenant_id,provider,created_at DESC);

CREATE TABLE IF NOT EXISTS data_change_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id UUID REFERENCES operation_run(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenant(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organization(id) ON DELETE SET NULL,
  table_name VARCHAR(128) NOT NULL, record_key TEXT NOT NULL,
  action VARCHAR(12) NOT NULL CHECK(action IN ('insert','update','delete','restore')),
  actor_type VARCHAR(40), actor_id VARCHAR(160),
  changed_fields TEXT[] NOT NULL DEFAULT '{}', before_data JSONB, after_data JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_data_change_record ON data_change_history(tenant_id,table_name,record_key,occurred_at DESC);

CREATE OR REPLACE VIEW v_operations_health AS
SELECT r.tenant_id, c.component_key,
 count(*) FILTER (WHERE r.created_at >= now()-interval '24 hours') runs_24h,
 count(*) FILTER (WHERE r.status IN ('failed','timeout','blocked') AND r.created_at >= now()-interval '24 hours') failures_24h,
 round(avg(r.duration_ms) FILTER (WHERE r.created_at >= now()-interval '24 hours'),2) avg_duration_ms,
 max(r.created_at) last_run_at
FROM platform_component c LEFT JOIN operation_run r ON r.component_id=c.id
GROUP BY r.tenant_id,c.component_key;

CREATE OR REPLACE VIEW v_open_platform_errors AS
SELECT e.*,c.component_key,c.name component_name FROM error_occurrence e
JOIN platform_component c ON c.id=e.component_id WHERE e.resolved=FALSE ORDER BY e.last_seen_at DESC;
