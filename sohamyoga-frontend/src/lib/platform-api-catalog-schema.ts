// Platform API Catalog Schema — ensureSchema() creates all 4 tables needed for
// the Platform API Capabilities Catalog. Called at the start of every API route
// so tables exist on first hit without a separate migration step.

import { query } from '@/lib/postgres';

let schemaReady = false;

export async function ensurePlatformApiCatalogSchema(): Promise<void> {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS platform_api_offering (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      api_version TEXT,
      api_name TEXT NOT NULL,
      endpoint_path TEXT NOT NULL,
      http_method TEXT NOT NULL,
      capability TEXT NOT NULL,
      category TEXT NOT NULL,
      auth_type TEXT NOT NULL DEFAULT 'oauth2',
      required_scopes TEXT[] DEFAULT '{}',
      required_env_vars TEXT[] DEFAULT '{}',
      rate_limit_calls INTEGER,
      rate_limit_window TEXT,
      rate_limit_tier TEXT DEFAULT 'default',
      implementation_status TEXT DEFAULT 'not_built',
      our_api_route TEXT,
      is_stable BOOLEAN DEFAULT true,
      requires_review BOOLEAN DEFAULT false,
      data_returned JSONB DEFAULT '[]',
      example_request JSONB DEFAULT '{}',
      example_response JSONB DEFAULT '{}',
      notes TEXT,
      last_verified_at TIMESTAMPTZ,
      last_error TEXT,
      error_count_30d INTEGER DEFAULT 0,
      success_count_30d INTEGER DEFAULT 0,
      avg_latency_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, http_method, endpoint_path)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_api_quota (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      api_offering_id UUID REFERENCES platform_api_offering(id),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      calls_made INTEGER DEFAULT 0,
      calls_limit INTEGER,
      quota_pct_used NUMERIC(5,2) DEFAULT 0,
      throttled_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_call_at TIMESTAMPTZ,
      UNIQUE(platform, api_offering_id, date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_api_changelog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      change_type TEXT NOT NULL,
      endpoint_path TEXT,
      description TEXT NOT NULL,
      effective_date DATE,
      impact TEXT,
      our_action_required BOOLEAN DEFAULT false,
      our_action_taken TEXT,
      source_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_api_test_result (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      offering_id UUID REFERENCES platform_api_offering(id),
      platform TEXT NOT NULL,
      endpoint_path TEXT NOT NULL,
      http_method TEXT NOT NULL,
      test_type TEXT DEFAULT 'smoke',
      status TEXT NOT NULL,
      http_status INTEGER,
      response_time_ms INTEGER,
      error_message TEXT,
      response_preview TEXT,
      run_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  schemaReady = true;
}
