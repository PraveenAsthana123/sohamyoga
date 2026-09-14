import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const rows = await query(`SELECT id, code, name, occasion_date, country, is_active FROM festival_calendar WHERE tenant_id = $1 ORDER BY occasion_date`, [tenantId]);
  return Response.json({ festivals: rows.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { code?: string; name?: string; occasionDate?: string; country?: string | null } | null;
  if (!body?.code?.trim() || !body.name?.trim() || !body.occasionDate) {
    return Response.json({ error: 'code, name, and occasionDate are required.' }, { status: 400 });
  }
  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO festival_calendar (tenant_id, code, name, occasion_date, country, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, occasion_date = EXCLUDED.occasion_date, country = EXCLUDED.country, updated_at = now()
     RETURNING id`,
    [tenantId, body.code.trim(), body.name.trim(), body.occasionDate, body.country || null, principal?.id ?? null],
  );
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
