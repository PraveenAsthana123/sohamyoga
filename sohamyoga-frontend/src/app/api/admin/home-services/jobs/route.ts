import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const date = req.nextUrl.searchParams.get('date');
    const status = req.nextUrl.searchParams.get('status');
    const team = req.nextUrl.searchParams.get('team');
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (date) { values.push(date); conditions.push(`j.scheduled_at::date = $${values.length}`); }
    if (status) { values.push(status); conditions.push(`j.status = $${values.length}`); }
    if (team) { values.push(`%${team}%`); conditions.push(`array_to_string(j.assigned_team,',') ILIKE $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT j.*, c.first_name, c.last_name, c.address, c.phone, c.gate_code, c.pet_info
       FROM hs_job j JOIN hs_customer c ON c.id = j.customer_id
       ${where} ORDER BY j.scheduled_at ASC LIMIT 300`,
      values
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO hs_job (customer_id,service_type,scheduled_at,duration_hours,assigned_team,recurrence,price,payment_method,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.customer_id, b.service_type, b.scheduled_at, b.duration_hours ?? 3, b.assigned_team ?? [], b.recurrence ?? 'one_time', b.price, b.payment_method, b.notes]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
