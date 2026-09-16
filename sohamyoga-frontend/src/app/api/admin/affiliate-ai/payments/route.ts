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
    const [payments, stats] = await Promise.all([
      client.query('SELECT * FROM affiliate_payments ORDER BY created_at DESC'),
      client.query(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as pending_total,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) as paid_total FROM affiliate_payments`),
    ]);
    return Response.json({ payments: payments.rows, stats: stats.rows[0] });
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
      `INSERT INTO affiliate_payments (partner_name, amount, currency, status, tax_form, payment_method, due_date)
       VALUES ($1,$2,$3,'pending',$4,$5,$6) RETURNING *`,
      [body.partner_name, body.amount || 0, body.currency || 'CAD', body.tax_form, body.payment_method || 'bank_transfer', body.due_date]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
