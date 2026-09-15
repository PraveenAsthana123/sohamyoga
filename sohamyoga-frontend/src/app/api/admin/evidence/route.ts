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
  const [records, byType, bySubject] = await Promise.all([
    query(`SELECT * FROM evidence_record WHERE tenant_id = $1 ORDER BY collected_at DESC LIMIT 100`, [tenantId]),
    query<{ evidence_type: string; n: string }>(`SELECT evidence_type, count(*)::text AS n FROM evidence_record WHERE tenant_id = $1 GROUP BY evidence_type`, [tenantId]),
    query<{ subject_type: string; n: string }>(`SELECT subject_type, count(*)::text AS n FROM evidence_record WHERE tenant_id = $1 GROUP BY subject_type`, [tenantId]),
  ]);

  return Response.json({
    total: records.rowCount,
    records: records.rows,
    byType: Object.fromEntries(byType.rows.map((r) => [r.evidence_type, Number(r.n)])),
    bySubjectType: Object.fromEntries(bySubject.rows.map((r) => [r.subject_type, Number(r.n)])),
  });
}
