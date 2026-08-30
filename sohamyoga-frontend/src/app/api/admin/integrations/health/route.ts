import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getIntegrationHealth } from '@/lib/integrationHealth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const results = await getIntegrationHealth();
  return Response.json({ integrations: results, checkedAt: new Date().toISOString() });
}
