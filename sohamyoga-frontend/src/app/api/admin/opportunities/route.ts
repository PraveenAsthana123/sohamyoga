import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { runOpportunityEngine } from '@/domain/opportunity/OpportunityEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const rows = await query(`SELECT * FROM opportunity_candidate WHERE tenant_id = $1 ORDER BY rank ASC`, [tenantId]);
  return Response.json({ opportunities: rows.rows });
}

// Real, on-demand: reads the latest real kpi_snapshot per dimension
// (must run KPI Engine first) and generates real opportunity_candidate
// rows. Returns 0 candidates honestly if every real KPI dimension is
// currently healthy -- never fabricates an opportunity to fill the list.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const results = await runOpportunityEngine(tenantId, principal?.id ?? undefined);
  return Response.json({ count: results.length, opportunities: results });
}
