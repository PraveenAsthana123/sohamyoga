import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer } from '@/lib/customer-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real customer-facing Reward Catalog read -- only active, in-stock rewards.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, name, description, points_cost, stock FROM reward_catalog_item
     WHERE tenant_id = $1 AND is_active = true AND (stock IS NULL OR stock > 0)
     ORDER BY points_cost ASC`,
    [tenantId],
  );
  return Response.json({ rewards: rows.rows });
}
