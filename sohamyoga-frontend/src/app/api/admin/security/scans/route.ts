import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const category = req.nextUrl.searchParams.get('category');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 200);

  const rows = category
    ? await query(
        `SELECT id, category, tool, target, status, triggered_by, started_at, completed_at, duration_ms, summary, error_message
         FROM security_scan_run WHERE tenant_id = $1 AND category = $2 ORDER BY started_at DESC LIMIT $3`,
        [tenantId, category, limit],
      )
    : await query(
        `SELECT id, category, tool, target, status, triggered_by, started_at, completed_at, duration_ms, summary, error_message
         FROM security_scan_run WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`,
        [tenantId, limit],
      );

  return Response.json({ scans: rows.rows });
}
