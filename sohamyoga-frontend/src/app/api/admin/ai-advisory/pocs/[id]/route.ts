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
    const { rows } = await client.query(`SELECT * FROM ai_pocs WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ poc: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { status, findings, recommendation } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ai_pocs SET status=COALESCE($1,status), findings=COALESCE($2,findings), recommendation=COALESCE($3,recommendation)
       WHERE id=$4 RETURNING *`,
      [status, findings, recommendation, params.id]
    );
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ poc: rows[0] });
  } finally {
    client.release();
  }
}
