export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM affiliate_attribution ORDER BY created_at DESC');
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO affiliate_attribution (conversion_id, touchpoints, first_touch_partner, last_touch_partner, linear_credit, time_decay_credit, revenue)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.conversion_id, JSON.stringify(body.touchpoints || []), body.first_touch_partner, body.last_touch_partner,
       JSON.stringify(body.linear_credit || {}), JSON.stringify(body.time_decay_credit || {}), body.revenue || 0]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
