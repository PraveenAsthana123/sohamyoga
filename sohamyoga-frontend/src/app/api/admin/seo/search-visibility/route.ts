import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real reader for marketing_search_visibility_snapshot, written by the new
// weekly SearchVisibilityJob (real Matomo organic-search keyword data --
// no fabricated SERP position/citation). Zero rows is the honest state
// until either the job has run against a real Matomo deployment, or geo/
// local visibility_type rows get a real writer (both currently blocked on
// external API credentials this environment doesn't have -- documented,
// not silently hidden).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query<{
    query: string; engine: string; visibility_type: string; position: string | null;
    is_cited: boolean | null; brand_mentioned: boolean; measured_at: string;
  }>(
    `SELECT DISTINCT ON (query, visibility_type) query, engine, visibility_type, position, is_cited, brand_mentioned, measured_at
     FROM marketing_search_visibility_snapshot
     WHERE tenant_id = $1
     ORDER BY query, visibility_type, measured_at DESC
     LIMIT 100`,
    [tenantId],
  );

  return Response.json({
    snapshots: rows.rows.map(r => ({
      query: r.query, engine: r.engine, visibilityType: r.visibility_type,
      position: r.position, isCited: r.is_cited, brandMentioned: r.brand_mentioned, measuredAt: r.measured_at,
    })),
  });
}
