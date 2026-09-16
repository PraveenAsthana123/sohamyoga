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
    const { rows } = await client.query('SELECT * FROM porter_analyses WHERE id=$1', [id]);
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
      `UPDATE porter_analyses SET competitive_rivalry=COALESCE($1,competitive_rivalry), supplier_power=COALESCE($2,supplier_power),
       buyer_power=COALESCE($3,buyer_power), threat_new_entry=COALESCE($4,threat_new_entry), threat_substitutes=COALESCE($5,threat_substitutes),
       summary=COALESCE($6,summary), recommendations=COALESCE($7,recommendations) WHERE id=$8 RETURNING *`,
      [body.competitive_rivalry, body.supplier_power, body.buyer_power, body.threat_new_entry, body.threat_substitutes, body.summary, body.recommendations, id]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
