import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getCroSummary, recordFrictionFinding } from '@/domain/cro/CroEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  return Response.json(await getCroSummary(tenantId));
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { pagePath?: string; frictionType?: string; severity?: string; description?: string } | null;
  if (!body?.pagePath || !body.frictionType || !body.severity || !body.description) {
    return Response.json({ error: 'pagePath, frictionType, severity, and description are required.' }, { status: 400 });
  }
  const tenantId = await getPrimaryTenantId();
  const finding = await recordFrictionFinding(tenantId, body.pagePath, body.frictionType, body.severity, body.description, principal?.email ?? 'admin');
  return Response.json({ finding }, { status: 201 });
}
