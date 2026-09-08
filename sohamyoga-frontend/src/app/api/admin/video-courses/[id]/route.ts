import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status) return Response.json({ error: 'status is required.' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM video_course WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Course not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" course to "${body.status}".` }, { status: 409 });
  }

  await query(`UPDATE video_course SET status = $2, updated_at = now() WHERE id = $1`, [id, body.status]);
  return Response.json({ ok: true });
}
