import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ['customer_enabled','requires_approval','approval_mode','customer_daily_limit','customer_monthly_limit','notes','is_configured'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of allowed) {
    if (key in body) { sets.push(`${key}=$${vals.length + 1}`); vals.push(body[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  sets.push(`updated_at=NOW()`, `updated_by='admin'`);
  vals.push(params.id);

  await query(`UPDATE platform_feature_permission SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  const updated = await query('SELECT * FROM platform_feature_permission WHERE id=$1', [params.id]);
  return Response.json({ permission: updated.rows[0] });
}
