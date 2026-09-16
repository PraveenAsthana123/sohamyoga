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
    const { rows } = await client.query('SELECT * FROM demand_forecasts ORDER BY period DESC, service_name');
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
      `INSERT INTO demand_forecasts (service_name, period, actual_bookings, forecasted_bookings, confidence_pct, factors)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.service_name, body.period, body.actual_bookings || 0, body.forecasted_bookings || 0, body.confidence_pct || 70, body.factors || []]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
