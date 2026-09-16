import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const technician = searchParams.get('technician');
  const date = searchParams.get('date');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT wo.*, c.first_name, c.last_name, c.phone,
             v.year, v.make, v.model, v.license_plate, v.color
      FROM ar_work_order wo
      LEFT JOIN ar_customer c ON c.id = wo.customer_id
      LEFT JOIN ar_vehicle v ON v.id = wo.vehicle_id
      WHERE ($1::text IS NULL OR wo.status = $1)
        AND ($2::text IS NULL OR wo.technician = $2)
        AND ($3::text IS NULL OR DATE(wo.created_at) = $3::date)
      ORDER BY wo.created_at DESC
      LIMIT 200
    `, [status||null, technician||null, date||null]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { customer_id, vehicle_id, technician, service_advisor, odometer_in, customer_concern, promised_time } = body;
  if (!customer_id || !vehicle_id || !customer_concern) return Response.json({ error: 'customer_id, vehicle_id, customer_concern required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Generate WO number: WO-YYYY-NNNN
    const year = new Date().getFullYear();
    const { rows: cntRows } = await client.query(`SELECT COUNT(*) AS n FROM ar_work_order WHERE wo_number LIKE $1`, [`WO-${year}-%`]);
    const seq = (parseInt(cntRows[0].n) + 1).toString().padStart(4, '0');
    const wo_number = `WO-${year}-${seq}`;
    const { rows } = await client.query(`
      INSERT INTO ar_work_order (customer_id, vehicle_id, wo_number, technician, service_advisor, odometer_in, customer_concern, promised_time)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [customer_id, vehicle_id, wo_number, technician||null, service_advisor||null, odometer_in||null, customer_concern, promised_time||null]);
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
