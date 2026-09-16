// ApiQuotaMonitorJob — every 4 hours
// For each platform in platform_api_offering, aggregate today's test call counts
// and update platform_api_quota. If quota > 85%, fire a social_alert_event.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface PlatformUsageRow {
  platform: string;
  offering_id: string;
  call_count: string;
  rate_limit_calls: number | null;
}

interface AlertCheckRow {
  platform: string;
  offering_id: string;
  calls_made: number;
  calls_limit: number | null;
  quota_pct_used: string;
}

export async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  // Ensure tables exist (lightweight check)
  await db.query(`
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

  await db.query(`
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

  await db.query(`
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

  console.log('[api-quota-monitor] Starting quota aggregation');

  // Aggregate today's test results by offering
  const usageResult = await db.query<PlatformUsageRow>(
    `SELECT tr.platform, tr.offering_id, COUNT(*) as call_count,
            o.rate_limit_calls
     FROM platform_api_test_result tr
     LEFT JOIN platform_api_offering o ON o.id = tr.offering_id
     WHERE tr.run_at >= CURRENT_DATE AND tr.offering_id IS NOT NULL
     GROUP BY tr.platform, tr.offering_id, o.rate_limit_calls`,
  );

  let quotaUpdated = 0;

  for (const row of usageResult.rows) {
    const callsMade = parseInt(row.call_count, 10);
    const callsLimit = row.rate_limit_calls;
    const quotaPct = callsLimit ? Math.min(100, (callsMade / callsLimit) * 100) : 0;

    await db.query(
      `INSERT INTO platform_api_quota
         (platform, api_offering_id, date, calls_made, calls_limit, quota_pct_used, last_call_at)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, NOW())
       ON CONFLICT (platform, api_offering_id, date) DO UPDATE SET
         calls_made = EXCLUDED.calls_made,
         calls_limit = EXCLUDED.calls_limit,
         quota_pct_used = EXCLUDED.quota_pct_used,
         last_call_at = NOW()`,
      [row.platform, row.offering_id, callsMade, callsLimit, quotaPct],
    );
    quotaUpdated++;
  }

  console.log(`[api-quota-monitor] Updated ${quotaUpdated} quota records`);

  // Fire alerts for platforms over 85% quota
  const alertResult = await db.query<AlertCheckRow>(
    `SELECT platform, api_offering_id as offering_id, calls_made, calls_limit, quota_pct_used
     FROM platform_api_quota
     WHERE date = CURRENT_DATE AND quota_pct_used > 85`,
  );

  for (const row of alertResult.rows) {
    try {
      await db.query(
        `INSERT INTO social_alert_event
           (alert_type, platform, severity, title, message, metadata, created_at)
         VALUES ('api_quota_warning', $1, 'high', $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [
          row.platform,
          `API Quota Warning: ${row.platform}`,
          `Platform ${row.platform} has used ${row.quota_pct_used}% of its API quota today (${row.calls_made}/${row.calls_limit ?? '?'} calls)`,
          JSON.stringify({ offering_id: row.offering_id, quota_pct: row.quota_pct_used }),
        ],
      );
      console.log(`[api-quota-monitor] Alert fired for ${row.platform} at ${row.quota_pct_used}%`);
    } catch {
      // social_alert_event table may not exist yet — non-fatal
    }
  }

  console.log(`[api-quota-monitor] Done. ${alertResult.rows.length} quota alerts evaluated.`);
  await db.end();
}
