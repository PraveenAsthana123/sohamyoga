export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const seq = await client.query('SELECT * FROM outbound_sequences WHERE id=$1', [params.id]);
    if (!seq.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const contacts = await client.query('SELECT * FROM outbound_contacts WHERE sequence_id=$1 ORDER BY created_at DESC', [params.id]);
    return Response.json({ sequence: seq.rows[0], contacts: contacts.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });
    const sets: string[] = []; const vals: unknown[] = [];
    const allowed = ['name','type','steps','status'] as const;
    for (const k of allowed) {
      if (k in b) { vals.push(k === 'steps' ? JSON.stringify(b[k]) : b[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE outbound_sequences SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ sequence: rows[0] });
  } finally { client.release(); }
}
