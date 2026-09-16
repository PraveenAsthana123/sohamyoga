export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM growth_experiments WHERE id=$1', [id]);
    if (r.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const fields = ['name', 'hypothesis', 'status', 'channel', 'metric', 'baseline_value', 'target_value', 'actual_value', 'start_date', 'end_date', 'result', 'learnings'];
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
    }
    if (sets.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(id);
    const r = await client.query(`UPDATE growth_experiments SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (r.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
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
    await client.query('DELETE FROM growth_experiments WHERE id=$1', [id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
