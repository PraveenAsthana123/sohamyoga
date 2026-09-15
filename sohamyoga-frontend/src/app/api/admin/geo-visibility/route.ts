import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getGeoSummary, recordGeoObservation } from '@/domain/geo/GeoVisibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// API-only (no dedicated UI page yet, disclosed). Real, admin-entered
// observations only -- no AI-search-visibility API exists or is called here.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  return Response.json(await getGeoSummary(tenantId));
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { platform?: string; queryText?: string; wasMentioned?: boolean; excerpt?: string } | null;
  if (!body?.platform || !body.queryText || body.wasMentioned === undefined) {
    return Response.json({ error: 'platform, queryText, and wasMentioned are required.' }, { status: 400 });
  }
  const tenantId = await getPrimaryTenantId();
  const observation = await recordGeoObservation(tenantId, body.platform, body.queryText, body.wasMentioned, body.excerpt ?? '', principal?.email ?? 'admin');
  return Response.json({ observation }, { status: 201 });
}
