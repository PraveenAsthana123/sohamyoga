import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Product Launch Management -- product_master could only ever be
// created (always starting at 'draft'); no route anywhere ever changed its
// status, so a created product could never actually launch. Mirrors the
// TRANSITIONS pattern used elsewhere this session.
const TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['archived', 'out_of_stock'],
  out_of_stock: ['active', 'archived'],
  archived: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status) return Response.json({ error: 'status is required.' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM product_master WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Product not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" product to "${body.status}".` }, { status: 409 });
  }

  await query(`UPDATE product_master SET status = $2, updated_at = now() WHERE id = $1`, [id, body.status]);
  return Response.json({ ok: true });
}
