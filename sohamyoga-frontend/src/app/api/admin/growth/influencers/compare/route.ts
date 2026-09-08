import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { compareInfluencers } from '@/domain/growth/InfluencerAnalysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const ids = req.nextUrl.searchParams.get('ids');
  if (!ids) return Response.json({ error: 'An ids query param (comma-separated influencer ids) is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const rows = await compareInfluencers(tenantId, ids.split(',').filter(Boolean));
  return Response.json({ rows });
}
