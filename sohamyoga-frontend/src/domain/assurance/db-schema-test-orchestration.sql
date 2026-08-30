-- Test orchestration control plane. This schema is intentionally isolated
-- from business tables so it can move unchanged to its own microservice DB.
CREATE TABLE IF NOT EXISTS test_suite_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_key VARCHAR(120) NOT NULL UNIQUE,
  module_id UUID REFERENCES module_master(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  test_level VARCHAR(30) NOT NULL CHECK(test_level IN ('unit','contract','integration','e2e','load','security','accessibility','resilience')),
  objective TEXT NOT NULL,
  owner VARCHAR(120) NOT NULL,
  runner_key VARCHAR(120) NOT NULL,
  automatic_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_cron VARCHAR(80),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_case_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES test_suite_master(id) ON DELETE CASCADE,
  case_key VARCHAR(160) NOT NULL,
  name VARCHAR(240) NOT NULL,
  polarity VARCHAR(20) NOT NULL CHECK(polarity IN ('positive','negative','boundary','failure_injection')),
  scenario JSONB NOT NULL DEFAULT '{}',
  expected_result JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(suite_id,case_key)
);

CREATE TABLE IF NOT EXISTS test_execution_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES test_suite_master(id),
  idempotency_key VARCHAR(200) NOT NULL UNIQUE,
  trigger_mode VARCHAR(20) NOT NULL CHECK(trigger_mode IN ('manual','schedule','pipeline','api')),
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','passed','failed','blocked','cancelled')),
  requested_by VARCHAR(160) NOT NULL,
  target_environment VARCHAR(40) NOT NULL DEFAULT 'local',
  parameters JSONB NOT NULL DEFAULT '{}',
  total_cases INTEGER NOT NULL DEFAULT 0,
  passed_cases INTEGER NOT NULL DEFAULT 0,
  failed_cases INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_execution_queue ON test_execution_job(status,created_at);

CREATE TABLE IF NOT EXISTS test_case_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES test_execution_job(id) ON DELETE CASCADE,
  test_case_id UUID REFERENCES test_case_master(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK(status IN ('passed','failed','blocked','skipped')),
  duration_ms BIGINT,
  actual_result JSONB NOT NULL DEFAULT '{}',
  evidence JSONB NOT NULL DEFAULT '{}',
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_target (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_key VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  concurrent_users INTEGER NOT NULL CHECK(concurrent_users > 0),
  duration_seconds INTEGER NOT NULL CHECK(duration_seconds > 0),
  max_error_rate NUMERIC(7,6) NOT NULL CHECK(max_error_rate BETWEEN 0 AND 1),
  p95_latency_ms INTEGER NOT NULL CHECK(p95_latency_ms > 0),
  min_requests_per_second NUMERIC(12,2) NOT NULL DEFAULT 0,
  scenario_tags TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO performance_target(target_key,name,concurrent_users,duration_seconds,max_error_rate,p95_latency_ms,min_requests_per_second,scenario_tags) VALUES
('customer-portal-1000','Customer portal mixed journey',1000,900,0.01,1500,100,ARRAY['registration','login','booking','membership','profile']),
('marketing-campaign-1000','Marketing campaign orchestration',1000,900,0.01,2000,75,ARRAY['campaign','email','social','reporting']),
('voice-operations-1000','Inbound/outbound call control plane',1000,900,0.01,1000,100,ARRAY['inbound','outbound','script','webhook'])
ON CONFLICT(target_key) DO UPDATE SET concurrent_users=EXCLUDED.concurrent_users,duration_seconds=EXCLUDED.duration_seconds,max_error_rate=EXCLUDED.max_error_rate,p95_latency_ms=EXCLUDED.p95_latency_ms,min_requests_per_second=EXCLUDED.min_requests_per_second,scenario_tags=EXCLUDED.scenario_tags;

INSERT INTO test_suite_master(suite_key,module_id,name,test_level,objective,owner,runner_key,automatic_enabled,schedule_cron)
SELECT v.suite_key,m.id,v.name,v.test_level,v.objective,'platform-quality',v.runner_key,TRUE,v.schedule_cron
FROM (VALUES
 ('customer-daily-e2e','customer','Customer daily-life journeys','e2e','Prove registration, login, booking, membership, payment, preferences and support journeys.','playwright_customer','0 3 * * *'),
 ('marketing-positive-negative','marketing','Marketing positive and negative scenarios','e2e','Prove campaign, email, content, social, ads and reporting success and rejection paths.','playwright_marketing','0 4 * * *'),
 ('voice-positive-negative','core','Voice inbound/outbound scenarios','integration','Prove webhook, consent, do-not-call, script, call outcome and provider-failure behavior.','voice_integration','0 5 * * *'),
 ('platform-load-1000','observability','One-thousand-customer capacity gate','load','Prove portal, campaign and voice control planes meet defined concurrency SLOs.','k6_1000','0 2 * * 0')
) AS v(suite_key,module_key,name,test_level,objective,runner_key,schedule_cron)
JOIN module_master m ON m.module_key=v.module_key
ON CONFLICT(suite_key) DO UPDATE SET name=EXCLUDED.name,objective=EXCLUDED.objective,runner_key=EXCLUDED.runner_key,automatic_enabled=EXCLUDED.automatic_enabled,schedule_cron=EXCLUDED.schedule_cron,updated_at=now();
