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
    const [deposits, stats] = await Promise.all([
      client.query('SELECT * FROM deposits ORDER BY created_at DESC'),
      client.query(`SELECT COALESCE(SUM(deposit_amount),0) as total_deposits, COALESCE(SUM(total_amount),0) as total_bookings,
        COUNT(*) FILTER (WHERE status='pending') as pending_count, COUNT(*) FILTER (WHERE status='paid') as paid_count
        FROM deposits`),
    ]);
    return Response.json({ deposits: deposits.rows, stats: stats.rows[0] });
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
      `INSERT INTO deposits (booking_reference, customer_name, service, total_amount, deposit_amount, status, due_date)
       VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING *`,
      [body.booking_reference, body.customer_name, body.service, body.total_amount || 0, body.deposit_amount || 0, body.due_date]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
