import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Reward Catalog -- loyalty_earn_rule/loyalty_transaction had a real
// earning side but no catalog of what points could be spent on, and no
// redemption write path (points only ever went up). First real build.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, name, description, points_cost, is_active, stock, updated_at
     FROM reward_catalog_item WHERE tenant_id = $1 ORDER BY points_cost ASC`,
    [tenantId],
  );
  return Response.json({ rewards: rows.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; description?: string; pointsCost?: number; isActive?: boolean; stock?: number | null;
  } | null;
  if (!body?.name?.trim() || !Number.isInteger(body.pointsCost) || (body.pointsCost as number) <= 0) {
    return Response.json({ error: 'name and a positive integer pointsCost are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO reward_catalog_item (tenant_id, name, description, points_cost, is_active, stock)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, description, points_cost, is_active, stock, updated_at`,
    [tenantId, body.name.trim(), body.description?.trim() || null, body.pointsCost, body.isActive ?? true, body.stock ?? null],
  );
  return Response.json({ reward: result.rows[0] }, { status: 201 });
}
