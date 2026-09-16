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
    const r = await client.query('SELECT * FROM decision_tables WHERE process_id=$1 ORDER BY created_at', [params.id]);
    return Response.json({ decisions: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.name) return Response.json({ error: 'name required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO decision_tables (process_id,name,conditions,rules,output_type)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [params.id, body.name,
       JSON.stringify(body.conditions || []),
       JSON.stringify(body.rules || []),
       body.output_type || 'text']
    );
    return Response.json({ decision: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
