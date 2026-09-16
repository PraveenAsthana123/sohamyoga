export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const m = await client.query('SELECT * FROM process_models WHERE id=$1', [params.id]);
    if (!m.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const [decisions, stakeholders] = await Promise.all([
      client.query('SELECT * FROM decision_tables WHERE process_id=$1 ORDER BY created_at', [params.id]),
      client.query('SELECT * FROM process_stakeholders WHERE process_id=$1 ORDER BY created_at', [params.id]),
    ]);
    return Response.json({ model: m.rows[0], decisions: decisions.rows, stakeholders: stakeholders.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const key of ['name','type','department','version','description','xml_definition','swimlanes','status'] as const) {
      if (key in body) { fields.push(`${key}=$${i++}`); vals.push(key === 'swimlanes' ? JSON.stringify(body[key]) : body[key]); }
    }
    if (!fields.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);
    const r = await client.query(`UPDATE process_models SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, vals);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ model: r.rows[0] });
  } finally { client.release(); }
}
