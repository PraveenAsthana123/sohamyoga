import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { computeBusinessTechnicalCorrelation, listRecentSnapshots } from '@/domain/marketing/HealthCorrelation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const [correlation, snapshots] = await Promise.all([
    computeBusinessTechnicalCorrelation(tenantId),
    listRecentSnapshots(tenantId, 20),
  ]);
  return Response.json({ correlation, snapshots });
}
