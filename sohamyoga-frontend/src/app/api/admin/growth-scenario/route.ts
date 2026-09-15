import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { projectAllScenarios } from '@/domain/presales/GrowthScenario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const acquisition = await query<{ value: string }>(
    `SELECT value FROM kpi_snapshot WHERE tenant_id = $1 AND dimension_key = 'acquisition' ORDER BY period_end DESC LIMIT 1`,
    [tenantId],
  );
  if (!acquisition.rowCount) return Response.json({ error: 'No real acquisition KPI snapshot yet -- run the KPI Engine first.' }, { status: 404 });
  const currentValue = Number(acquisition.rows[0].value);
  return Response.json({ baseMetric: 'acquisition (real students enrolled, trailing period)', currentValue, scenarios: projectAllScenarios(currentValue), disclosedAssumption: 'Growth rates (2%/5%/10% monthly) are stated assumptions, not derived from any real external market-data source -- disagree with them freely.' });
}
