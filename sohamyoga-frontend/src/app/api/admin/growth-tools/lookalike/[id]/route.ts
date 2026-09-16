import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const pool = getPool();
  const allowed = ['name', 'platform', 'source_type', 'source_size', 'lookalike_size_pct', 'country', 'estimated_reach', 'status', 'campaign_linked', 'performance_json'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { sets.push(`${key}=$${idx++}`); vals.push(body[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  vals.push(params.id);
  const { rows, rowCount } = await pool.query(
    `UPDATE lookalike_audiences SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`,
    vals,
  );
  if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ audience: rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const { rowCount } = await pool.query(`DELETE FROM lookalike_audiences WHERE id=$1`, [params.id]);
  if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
