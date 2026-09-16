export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM sales_intel_deals WHERE id=$1', [id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE sales_intel_deals SET stage=COALESCE($1,stage), probability=COALESCE($2,probability),
       next_action=COALESCE($3,next_action), ai_notes=COALESCE($4,ai_notes) WHERE id=$5 RETURNING *`,
      [body.stage, body.probability, body.next_action, body.ai_notes, id]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
