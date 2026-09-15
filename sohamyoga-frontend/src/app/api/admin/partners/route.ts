import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, admin-entered partner tracking -- no partner-discovery API exists.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const rows = await query(`SELECT * FROM business_partner WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
  return Response.json({ partners: rows.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { name?: string; partnerType?: string; fitScore?: number; notes?: string } | null;
  if (!body?.name || !body.partnerType) return Response.json({ error: 'name and partnerType are required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO business_partner (tenant_id, name, partner_type, fit_score, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, body.name, body.partnerType, body.fitScore ?? null, body.notes ?? '', principal?.email ?? 'admin'],
  );
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
