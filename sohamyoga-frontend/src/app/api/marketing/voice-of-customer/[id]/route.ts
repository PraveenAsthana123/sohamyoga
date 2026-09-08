import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  draft: ['reviewed', 'dismissed'],
  reviewed: [],
  dismissed: [],
};

// Real Feedback Lifecycle -- voice_of_customer_digest.status already had a
// real CHECK constraint (draft/reviewed/dismissed) but no route ever
// changed it: every digest sat in 'draft' forever with no way for staff to
// mark it acknowledged.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status) return Response.json({ error: 'status is required.' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM voice_of_customer_digest WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Digest not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" digest to "${body.status}".` }, { status: 409 });
  }

  await query(`UPDATE voice_of_customer_digest SET status = $2 WHERE id = $1`, [id, body.status]);
  return Response.json({ ok: true });
}
