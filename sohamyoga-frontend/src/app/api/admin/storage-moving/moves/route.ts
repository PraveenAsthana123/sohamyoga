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
    const date = searchParams.get('date') ?? '';
    const status = searchParams.get('status') ?? '';
    const type = searchParams.get('type') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (date) { vals.push(date); where += ` AND m.move_date = $${vals.length}`; }
    if (status) { vals.push(status); where += ` AND m.status = $${vals.length}`; }
    if (type) { vals.push(type); where += ` AND m.move_type = $${vals.length}`; }
    const { rows } = await client.query(
      `SELECT m.*, c.first_name, c.last_name, c.phone, c.email, c.customer_type
       FROM sm_move m JOIN sm_customer c ON c.id = m.customer_id
       ${where} ORDER BY m.move_date DESC, m.move_time ASC LIMIT 200`,
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
    const { rows } = await client.query(
      `INSERT INTO sm_move (customer_id, move_type, move_date, move_time, origin_address, origin_city, destination_address, destination_city, estimated_hours, crew_size, truck_size, status, quote_amount, deposit_paid, elevator_booking_required, packing_service, special_items, storage_needed, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [b.customer_id, b.move_type, b.move_date, b.move_time ?? '08:00', b.origin_address, b.origin_city ?? null, b.destination_address, b.destination_city ?? null, b.estimated_hours ?? null, b.crew_size ?? 2, b.truck_size ?? '16ft', b.status ?? 'quoted', b.quote_amount ?? null, b.deposit_paid ?? 0, b.elevator_booking_required ?? false, b.packing_service ?? false, b.special_items ?? null, b.storage_needed ?? false, b.notes ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
