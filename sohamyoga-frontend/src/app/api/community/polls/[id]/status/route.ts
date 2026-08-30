import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: 'activate' | 'close' } | null;
  const current = await query<{ status: string }>(`SELECT status FROM poll WHERE id = $1`, [params.id]);
  if (!current.rows.length) return Response.json({ error: 'Poll not found.' }, { status: 404 });

  if (body?.action === 'activate') {
    if (current.rows[0].status === 'CLOSED') return Response.json({ error: 'Cannot reactivate a closed poll.' }, { status: 422 });
    await query(`UPDATE poll SET status = 'ACTIVE' WHERE id = $1`, [params.id]);
    return Response.json({ ok: true, status: 'ACTIVE' });
  }
  if (body?.action === 'close') {
    await query(`UPDATE poll SET status = 'CLOSED' WHERE id = $1`, [params.id]);
    return Response.json({ ok: true, status: 'CLOSED' });
  }
  return Response.json({ error: 'action must be "activate" or "close".' }, { status: 400 });
}
