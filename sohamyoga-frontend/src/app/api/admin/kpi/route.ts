import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { runKpiEngine } from '@/domain/kpi/KpiEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT DISTINCT ON (dimension_key) * FROM kpi_snapshot WHERE tenant_id = $1 ORDER BY dimension_key, period_end DESC`,
    [tenantId],
  );
  return Response.json({ dimensions: rows.rows });
}

// Real, on-demand run — computes all 8 dimensions for a given real
// period (default: trailing 30 real days) and writes real kpi_snapshot
// + evidence_record rows. Same "real on-demand execution, not a
// simulation" pattern as the existing generic run-job endpoint.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { periodStart?: string; periodEnd?: string } | null;
  const periodEnd = body?.periodEnd || new Date().toISOString().slice(0, 10);
  const periodStart = body?.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const tenantId = await getPrimaryTenantId();
  const results = await runKpiEngine(tenantId, periodStart, periodEnd, principal?.id ?? undefined);
  return Response.json({ periodStart, periodEnd, results });
}
