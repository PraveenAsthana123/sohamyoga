import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getDemandMap, getFunnelConstraint, getBusinessProfile, confirmBusinessProfile } from '@/domain/diagnostic/BusinessDiagnostic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// API-only for now -- no dedicated admin UI page yet (disclosed, lower
// priority for a single-tenant dogfooding instance that already knows
// its own business). Real data, real computation either way.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const [demandMap, funnelConstraint, profile] = await Promise.all([
    getDemandMap(tenantId), getFunnelConstraint(tenantId), getBusinessProfile(tenantId),
  ]);
  return Response.json({ businessProfile: profile, demandMap, funnelConstraint });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { category?: string; notes?: string } | null;
  if (!body?.category) return Response.json({ error: 'category is required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();
  const profile = await confirmBusinessProfile(tenantId, body.category, principal?.email ?? 'admin', body.notes ?? '');
  return Response.json({ businessProfile: profile }, { status: 201 });
}
