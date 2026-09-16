import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => null) as {
    status?: string; reply_text?: string; assigned_to?: string;
  } | null;

  if (!body) return NextResponse.json({ error: 'No body' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

  if (body.reply_text !== undefined) {
    updates.reply_text = body.reply_text;
    updates.replied_at = new Date().toISOString();
    updates.status = 'replied';
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const result = await pool.query(
    `UPDATE contact_submission SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...keys.map(k => updates[k])],
  );

  if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ submission: result.rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  await pool.query(`DELETE FROM contact_submission WHERE id = $1`, [id]);
  return NextResponse.json({ deleted: true });
}
