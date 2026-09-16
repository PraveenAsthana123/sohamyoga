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
    const { rows } = await client.query('SELECT * FROM event_logistics_items ORDER BY created_at DESC');
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
      `INSERT INTO event_logistics_items (event_name, category, item_name, quantity, supplier, cost, status, delivery_date)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *`,
      [body.event_name, body.category, body.item_name, body.quantity || 1, body.supplier, body.cost || 0, body.delivery_date]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
