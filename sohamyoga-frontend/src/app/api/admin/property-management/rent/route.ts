import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const month = searchParams.get('month'); // YYYY-MM
      const status = searchParams.get('status');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (month) { vals.push(`${month}-01`); conditions.push(`DATE_TRUNC('month', r.due_date)=DATE_TRUNC('month',$${vals.length}::date)`); }
      if (status) { vals.push(status); conditions.push(`r.status=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT r.*, t.first_name, t.last_name, t.email, p.address
        FROM pm_rent_payment r
        LEFT JOIN pm_tenant t ON t.id=r.tenant_id
        LEFT JOIN pm_property p ON p.id=r.property_id
        ${where}
        ORDER BY r.due_date DESC
      `, vals);
      const overdue = rows.filter(r => r.status === 'pending' && new Date(r.due_date) < new Date()).length;
      return Response.json({ payments: rows, overdue_count: overdue });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { tenant_id, property_id, amount, due_date, paid_date, payment_method, status = 'pending', late_fee = 0, notes } = body;
    if (!tenant_id || !amount || !due_date) return Response.json({ error: 'tenant_id, amount, due_date required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO pm_rent_payment (tenant_id, property_id, amount, due_date, paid_date, payment_method, status, late_fee, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [tenant_id, property_id || null, amount, due_date, paid_date || null, payment_method, status, late_fee, notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
