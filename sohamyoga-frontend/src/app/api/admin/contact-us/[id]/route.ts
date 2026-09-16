import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => null) as {
    status?: string; reply_text?: string; assigned_to?: string;
  } | null;

  if (!body) return Response.json({ error: 'No body' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

  if (body.reply_text !== undefined) {
    updates.reply_text = body.reply_text;
    updates.replied_at = new Date().toISOString();
    updates.status = 'replied';
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const result = await pool.query(
    `UPDATE contact_submission SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...keys.map(k => updates[k])],
  );

  if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ submission: result.rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  await pool.query(`DELETE FROM contact_submission WHERE id = $1`, [id]);
  return Response.json({ deleted: true });
}
