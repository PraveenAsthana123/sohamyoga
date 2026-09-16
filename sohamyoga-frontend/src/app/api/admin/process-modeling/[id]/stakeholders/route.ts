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
    const r = await client.query('SELECT * FROM process_stakeholders WHERE process_id=$1 ORDER BY lane, name', [params.id]);
    return Response.json({ stakeholders: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.role) return Response.json({ error: 'name and role required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO process_stakeholders (process_id,name,role,lane,responsibilities)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [params.id, body.name, body.role, body.lane || null,
       body.responsibilities ? body.responsibilities : []]
    );
    return Response.json({ stakeholder: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
