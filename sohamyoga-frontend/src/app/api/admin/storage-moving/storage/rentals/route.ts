import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (status) { vals.push(status); where += ` AND sr.status = $${vals.length}`; }
    // Mark overdue: active but last payment > 35 days ago
    const { rows } = await client.query(
      `SELECT sr.*, c.first_name, c.last_name, c.phone, c.email,
              su.unit_number, su.unit_size, su.unit_type, su.monthly_rate AS unit_rate,
              CASE WHEN sr.status = 'active' AND (sr.last_payment_date IS NULL OR sr.last_payment_date < NOW() - INTERVAL '35 days') THEN true ELSE false END AS is_overdue
       FROM sm_storage_rental sr
       JOIN sm_customer c ON c.id = sr.customer_id
       JOIN sm_storage_unit su ON su.id = sr.unit_id
       ${where} ORDER BY sr.created_at DESC LIMIT 200`,
      vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    await client.query('BEGIN');
    // Check unit availability
    const { rows: [unit] } = await client.query(`SELECT * FROM sm_storage_unit WHERE id = $1 FOR UPDATE`, [b.unit_id]);
    if (!unit) { await client.query('ROLLBACK'); return Response.json({ error: 'Unit not found' }, { status: 404 }); }
    if (unit.is_occupied) { await client.query('ROLLBACK'); return Response.json({ error: 'Unit is already occupied' }, { status: 409 }); }
    const { rows } = await client.query(
      `INSERT INTO sm_storage_rental (unit_id, customer_id, start_date, monthly_rate, security_deposit, access_code, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.unit_id, b.customer_id, b.start_date, b.monthly_rate ?? unit.monthly_rate, b.security_deposit ?? null, b.access_code ?? null, b.payment_method ?? null, b.notes ?? null]
    );
    await client.query(`UPDATE sm_storage_unit SET is_occupied = true WHERE id = $1`, [b.unit_id]);
    await client.query('COMMIT');
    return Response.json(rows[0], { status: 201 });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
