import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { savePositioningStatement, getPositioningStatement, renderPositioningStatement } from '@/domain/positioning/Positioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const statement = await getPositioningStatement(tenantId);
  return Response.json({ statement, rendered: statement ? renderPositioningStatement({ targetCustomer: statement.target_customer, problem: statement.problem, category: statement.category, outcome: statement.outcome, alternative: statement.alternative, proof: statement.proof }) : null });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as Partial<{ targetCustomer: string; problem: string; category: string; outcome: string; alternative: string; proof: string }> | null;
  if (!body?.targetCustomer || !body.problem || !body.category || !body.outcome || !body.alternative || !body.proof) {
    return Response.json({ error: 'targetCustomer, problem, category, outcome, alternative, and proof are all required.' }, { status: 400 });
  }
  const tenantId = await getPrimaryTenantId();
  const statement = await savePositioningStatement(tenantId, body as any, principal?.email ?? 'admin');
  return Response.json({ statement, rendered: renderPositioningStatement(body as any) }, { status: 201 });
}
