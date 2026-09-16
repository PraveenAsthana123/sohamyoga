// Shared ensureSchema for Module Intelligence Hub tables
import { query } from '@/lib/postgres';

let schemaEnsured = false;

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS test_plan (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      version TEXT DEFAULT '1.0',
      objective TEXT,
      scope_in TEXT,
      scope_out TEXT,
      environment TEXT DEFAULT 'local',
      test_data_source TEXT DEFAULT 'synthetic',
      kaggle_dataset TEXT,
      total_cases INTEGER DEFAULT 0,
      positive_cases INTEGER DEFAULT 0,
      negative_cases INTEGER DEFAULT 0,
      boundary_cases INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_by TEXT DEFAULT 'system',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_case_extended (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id UUID REFERENCES test_plan(id),
      module_key TEXT NOT NULL,
      suite_key TEXT,
      case_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      test_level TEXT NOT NULL,
      polarity TEXT NOT NULL,
      scenario_type TEXT,
      precondition TEXT,
      steps JSONB DEFAULT '[]',
      expected_result TEXT,
      actual_result TEXT,
      test_data JSONB DEFAULT '{}',
      api_endpoint TEXT,
      ui_field TEXT,
      http_method TEXT,
      request_payload JSONB,
      expected_status INTEGER,
      tags TEXT[] DEFAULT '{}',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      failure_reason TEXT,
      screenshot_url TEXT,
      duration_ms INTEGER,
      run_count INTEGER DEFAULT 0,
      last_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_run_session (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id UUID REFERENCES test_plan(id),
      module_key TEXT NOT NULL,
      run_label TEXT,
      trigger TEXT DEFAULT 'manual',
      environment TEXT DEFAULT 'local',
      total INTEGER DEFAULT 0,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      blocked INTEGER DEFAULT 0,
      pass_rate NUMERIC(5,2) DEFAULT 0,
      duration_ms BIGINT DEFAULT 0,
      runner TEXT,
      status TEXT DEFAULT 'running',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS test_run_result (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES test_run_session(id),
      case_id UUID REFERENCES test_case_extended(id),
      module_key TEXT NOT NULL,
      status TEXT NOT NULL,
      actual_result TEXT,
      failure_reason TEXT,
      http_status INTEGER,
      response_body JSONB,
      screenshot_url TEXT,
      duration_ms INTEGER,
      run_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS module_scenario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL,
      scenario_category TEXT NOT NULL,
      scenario_name TEXT NOT NULL,
      description TEXT,
      actors TEXT[] DEFAULT '{}',
      preconditions TEXT,
      steps JSONB DEFAULT '[]',
      expected_outcome TEXT,
      data_fields JSONB DEFAULT '{}',
      integration_platform TEXT,
      is_automated BOOLEAN DEFAULT false,
      test_case_key TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_dataset (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL,
      dataset_name TEXT NOT NULL,
      source TEXT NOT NULL,
      kaggle_ref TEXT,
      record_count INTEGER DEFAULT 0,
      schema_definition JSONB DEFAULT '{}',
      sample_rows JSONB DEFAULT '[]',
      download_url TEXT,
      local_path TEXT,
      status TEXT DEFAULT 'available',
      generated_by TEXT DEFAULT 'ollama',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS module_nav_map (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL,
      portal TEXT NOT NULL,
      screen_name TEXT NOT NULL,
      route TEXT NOT NULL,
      parent_route TEXT,
      tab TEXT,
      ui_elements JSONB DEFAULT '[]',
      actions JSONB DEFAULT '[]',
      breadcrumb TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS module_alert_scenario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL,
      alert_name TEXT NOT NULL,
      trigger_condition TEXT NOT NULL,
      threshold TEXT,
      severity TEXT DEFAULT 'medium',
      notification_channels TEXT[] DEFAULT '{email}',
      auto_remediation TEXT,
      example_payload JSONB DEFAULT '{}',
      is_configured BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS module_tenant_scenario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL,
      tenant_type TEXT NOT NULL,
      scenario_name TEXT NOT NULL,
      description TEXT,
      data_isolation_notes TEXT,
      custom_config JSONB DEFAULT '{}',
      test_tenant_seed_sql TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  schemaEnsured = true;
}
