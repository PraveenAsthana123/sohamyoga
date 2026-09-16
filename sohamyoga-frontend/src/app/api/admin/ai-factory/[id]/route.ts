export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM ai_factory_models WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ model: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { status, performance_score } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ai_factory_models SET status=COALESCE($1,status), performance_score=COALESCE($2,performance_score)
       WHERE id=$3 RETURNING *`,
      [status, performance_score, params.id]
    );
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ model: rows[0] });
  } finally {
    client.release();
  }
}
