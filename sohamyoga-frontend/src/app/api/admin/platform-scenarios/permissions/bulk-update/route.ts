import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PermissionUpdate {
  id: string;
  customer_enabled?: boolean;
  requires_approval?: boolean;
  approval_mode?: string;
  customer_daily_limit?: number | null;
  customer_monthly_limit?: number | null;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const { updates } = await req.json() as { updates: PermissionUpdate[] };
  if (!Array.isArray(updates) || !updates.length) {
    return Response.json({ error: 'updates array required' }, { status: 400 });
  }

  let updated = 0;
  for (const u of updates) {
    const allowed = ['customer_enabled','requires_approval','approval_mode','customer_daily_limit','customer_monthly_limit','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of allowed) {
      if (key in u) { sets.push(`${key}=$${vals.length + 1}`); vals.push((u as unknown as Record<string,unknown>)[key]); }
    }
    if (!sets.length) continue;
    sets.push(`updated_at=NOW()`, `updated_by='admin'`);
    vals.push(u.id);
    const r = await query(`UPDATE platform_feature_permission SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
    updated += r.rowCount ?? 0;
  }
  return Response.json({ updated });
}
