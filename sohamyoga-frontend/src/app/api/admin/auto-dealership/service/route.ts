import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const status = searchParams.get('status');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds = [`appointment_date = $1`];
      const vals: unknown[] = [date];
      if (status) { conds.push(`status = $2`); vals.push(status); }
      const { rows } = await client.query(
        `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
         FROM auto_service_appointment s
         LEFT JOIN auto_customer c ON c.id = s.customer_id
         WHERE ${conds.join(' AND ')} ORDER BY appointment_time ASC NULLS LAST`,
        vals
      );
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO auto_service_appointment
          (customer_id, customer_vehicle, service_type, description, advisor,
           appointment_date, appointment_time, status, labour_rate, loaner_vehicle, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.customer_id, body.customer_vehicle, body.service_type, body.description, body.advisor,
         body.appointment_date, body.appointment_time, body.status ?? 'scheduled',
         body.labour_rate ?? 145, body.loaner_vehicle, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
