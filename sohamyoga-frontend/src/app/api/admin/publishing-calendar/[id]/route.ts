export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, published_at, title, platform, scheduled_at, content_body, tags, assigned_to } = body;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (status !== undefined) { vals.push(status); sets.push(`status=$${vals.length}`); }
    if (published_at !== undefined) { vals.push(published_at); sets.push(`published_at=$${vals.length}`); }
    if (title !== undefined) { vals.push(title); sets.push(`title=$${vals.length}`); }
    if (platform !== undefined) { vals.push(platform); sets.push(`platform=$${vals.length}`); }
    if (scheduled_at !== undefined) { vals.push(scheduled_at); sets.push(`scheduled_at=$${vals.length}`); }
    if (content_body !== undefined) { vals.push(content_body); sets.push(`content_body=$${vals.length}`); }
    if (tags !== undefined) { vals.push(tags); sets.push(`tags=$${vals.length}`); }
    if (assigned_to !== undefined) { vals.push(assigned_to); sets.push(`assigned_to=$${vals.length}`); }

    if (sets.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Auto-set published_at when marking published
    if (status === 'published' && published_at === undefined) {
      sets.push(`published_at=NOW()`);
    }

    vals.push(id);
    const r = await client.query(
      `UPDATE publishing_calendar SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (r.rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM publishing_calendar WHERE id=$1', [id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
