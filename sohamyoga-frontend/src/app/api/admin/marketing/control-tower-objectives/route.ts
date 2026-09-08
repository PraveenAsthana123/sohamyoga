import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getObjectivesStatus, setObjectiveTarget, ObjectiveMetric } from '@/domain/marketing/ControlTowerObjectives';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const objectives = await getObjectivesStatus(tenantId);
  return Response.json({ objectives });
}

const VALID_METRICS: ObjectiveMetric[] = ['revenue_monthly', 'new_leads_monthly', 'bookings_monthly'];
interface Body { metricKey?: string; targetValue?: number }

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Body | null;
  if (!body || !VALID_METRICS.includes(body.metricKey as ObjectiveMetric)) {
    return Response.json({ error: `metricKey must be one of ${VALID_METRICS.join(', ')}.` }, { status: 400 });
  }
  if (typeof body.targetValue !== 'number' || body.targetValue <= 0) {
    return Response.json({ error: 'targetValue must be a positive number.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  await setObjectiveTarget(tenantId, body.metricKey as ObjectiveMetric, body.targetValue, 'admin');
  const objectives = await getObjectivesStatus(tenantId);
  return Response.json({ objectives });
}
