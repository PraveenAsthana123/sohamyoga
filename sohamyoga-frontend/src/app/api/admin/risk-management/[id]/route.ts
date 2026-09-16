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
    const r = await client.query('SELECT * FROM risk_register WHERE id=$1', [params.id]);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ risk: r.rows[0] });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const allowed = ['title','category','description','likelihood','impact','owner','controls','status','treatment'] as const;
  const fields: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const key of allowed) {
    if (key in body) { fields.push(`${key}=$${i++}`); vals.push(body[key]); }
  }
  if (!fields.length) return Response.json({ error: 'No fields' }, { status: 400 });
  vals.push(params.id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(`UPDATE risk_register SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, vals);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ risk: r.rows[0] });
  } finally { client.release(); }
}
