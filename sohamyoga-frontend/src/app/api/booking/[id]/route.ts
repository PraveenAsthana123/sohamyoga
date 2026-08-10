import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/booking/:id — { action: 'check_in' | 'cancel' }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (body?.action === 'check_in') {
    await query(
      `UPDATE booking SET status = 'checked_in', checked_in_at = now() WHERE id = $1 AND status IN ('confirmed','pending')`,
      [params.id],
    );
  } else if (body?.action === 'cancel') {
    await query(
      `UPDATE booking SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [params.id],
    );
  } else {
    return Response.json({ error: "action must be 'check_in' or 'cancel'" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
