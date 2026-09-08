import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { routeUnassignedLeads } from '@/domain/marketing/LeadRouting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const results = await routeUnassignedLeads(tenantId);
  return Response.json({ routed: results });
}
