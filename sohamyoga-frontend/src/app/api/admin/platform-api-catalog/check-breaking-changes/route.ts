import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

import { requireAdmin } from '@/lib/admin-auth';
interface BreakingRow {
  id: string;
  platform: string;
  endpoint_path: string;
  http_method: string;
  capability: string;
  implementation_status: string;
  last_status: string;
  last_http_status: number | null;
  last_run_at: string;
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensurePlatformApiCatalogSchema();

  // Find offerings that were recently tested and failed, but are marked as built/verified
  const result = await query<BreakingRow>(
    `SELECT DISTINCT ON (o.id)
       o.id, o.platform, o.endpoint_path, o.http_method, o.capability, o.implementation_status,
       tr.status as last_status, tr.http_status as last_http_status, tr.run_at as last_run_at
     FROM platform_api_offering o
     JOIN platform_api_test_result tr ON tr.offering_id = o.id
     WHERE o.implementation_status IN ('built', 'verified', 'partial')
       AND tr.status = 'fail'
       AND tr.run_at >= NOW() - INTERVAL '7 days'
     ORDER BY o.id, tr.run_at DESC`,
    [],
  );

  const breakingChanges = result.rows.map((row) => ({
    offering_id: row.id,
    platform: row.platform,
    endpoint_path: row.endpoint_path,
    http_method: row.http_method,
    capability: row.capability,
    current_status: row.implementation_status,
    last_test_status: row.last_status,
    last_http_status: row.last_http_status,
    last_run_at: row.last_run_at,
    recommended_action: 'Investigate endpoint failure and update implementation_status if broken',
  }));

  return Response.json({
    breaking_changes: breakingChanges,
    count: breakingChanges.length,
    checked_at: new Date().toISOString(),
  });
}
