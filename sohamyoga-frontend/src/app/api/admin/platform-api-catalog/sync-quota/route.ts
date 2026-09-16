import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

interface TestResultRow {
  offering_id: string;
  platform: string;
  count: string;
}

export async function POST() {
  await ensurePlatformApiCatalogSchema();

  // Aggregate today's test results by offering
  const testResults = await query<TestResultRow>(
    `SELECT offering_id, platform, COUNT(*) as count
     FROM platform_api_test_result
     WHERE run_at >= CURRENT_DATE AND offering_id IS NOT NULL
     GROUP BY offering_id, platform`,
    [],
  );

  let synced = 0;

  for (const row of testResults.rows) {
    // Get the offering's rate limit
    const offeringResult = await query(
      `SELECT rate_limit_calls, rate_limit_window FROM platform_api_offering WHERE id = $1`,
      [row.offering_id],
    );
    const offering = offeringResult.rows[0] as { rate_limit_calls: number | null; rate_limit_window: string | null } | undefined;
    const callsMade = parseInt(row.count, 10);
    const callsLimit = offering?.rate_limit_calls ?? null;
    const quotaPct = callsLimit ? Math.min(100, (callsMade / callsLimit) * 100) : 0;

    await query(
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
    synced++;
  }

  return NextResponse.json({ synced, message: `Synced ${synced} quota records for today` });
}
