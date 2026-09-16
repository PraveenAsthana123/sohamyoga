import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensurePlatformApiCatalogSchema();
  const platform = req.nextUrl.searchParams.get('platform');

  const conditions: string[] = [`q.date = CURRENT_DATE`];
  const params: unknown[] = [];
  let idx = 1;

  if (platform) {
    conditions.push(`q.platform = $${idx++}`);
    params.push(platform);
  }

  const result = await query(
    `SELECT q.*, o.endpoint_path, o.capability, o.category
     FROM platform_api_quota q
     LEFT JOIN platform_api_offering o ON o.id = q.api_offering_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY q.quota_pct_used DESC`,
    params,
  );

  // Also get per-platform summary
  const summaryResult = await query(
    `SELECT platform,
            SUM(calls_made) as total_calls,
            SUM(throttled_count) as total_throttled,
            SUM(error_count) as total_errors,
            MAX(quota_pct_used) as max_quota_pct,
            MAX(last_call_at) as last_call_at
     FROM platform_api_quota
     WHERE date = CURRENT_DATE
     GROUP BY platform
     ORDER BY max_quota_pct DESC`,
    [],
  );

  return Response.json({ quotas: result.rows, summary: summaryResult.rows });
}
