import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Update or delete a single content_calendar_entry row. See ../route.ts for context. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    title?: string; contentType?: string; channel?: string | null; scheduledAt?: string;
    status?: string; briefId?: string | null; assignedTo?: string | null;
    tags?: string[]; notes?: string | null;
  } | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const result = await query(
    `UPDATE content_calendar_entry
     SET title = COALESCE($2, title), content_type = COALESCE($3, content_type),
         channel = $4, scheduled_at = COALESCE($5, scheduled_at), status = COALESCE($6, status),
         brief_id = $7, assigned_to = $8, tags = COALESCE($9, tags), notes = $10, updated_at = now()
     WHERE id = $1 RETURNING id`,
    [
      id, body.title?.trim() ?? null, body.contentType ?? null, body.channel ?? null,
      body.scheduledAt ?? null, body.status ?? null, body.briefId ?? null, body.assignedTo ?? null,
      body.tags ?? null, body.notes ?? null,
    ],
  );
  if (!result.rowCount) return Response.json({ error: 'Calendar entry not found.' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query(`DELETE FROM content_calendar_entry WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Calendar entry not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
