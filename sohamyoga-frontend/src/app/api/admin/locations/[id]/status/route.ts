import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { updateLocationStatus } from '@/domain/seo/locationRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending_setup', 'active', 'inactive', 'suspended'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!VALID_STATUSES.includes(body?.status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const location = await updateLocationStatus(tenantId, params.id, body.status);
  if (!location) return Response.json({ error: 'Location not found.' }, { status: 404 });
  return Response.json(location);
}
