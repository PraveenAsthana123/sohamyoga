import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string; event_type: string; points_awarded: number; is_active: boolean; updated_at: string }>(
    `SELECT id, event_type, points_awarded, is_active, updated_at FROM loyalty_earn_rule WHERE tenant_id = $1 ORDER BY event_type`,
    [tenantId],
  );
  return Response.json({
    rules: result.rows.map((r) => ({ id: r.id, eventType: r.event_type, pointsAwarded: r.points_awarded, isActive: r.is_active, updatedAt: r.updated_at })),
  });
}

interface Body { eventType?: string; pointsAwarded?: number; isActive?: boolean }

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Body | null;
  if (!body?.eventType?.trim()) return Response.json({ error: 'eventType is required.' }, { status: 400 });
  if (!Number.isInteger(body.pointsAwarded) || (body.pointsAwarded ?? 0) <= 0) {
    return Response.json({ error: 'pointsAwarded must be a positive integer.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  await query(
    `INSERT INTO loyalty_earn_rule (tenant_id, event_type, points_awarded, is_active, updated_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, event_type) DO UPDATE SET points_awarded = $3, is_active = $4, updated_by = $5, updated_at = now()`,
    [tenantId, body.eventType.trim(), body.pointsAwarded, body.isActive ?? true, principal?.email ?? 'admin'],
  );
  return Response.json({ ok: true });
}
