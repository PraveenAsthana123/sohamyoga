import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [woRes, itemsRes] = await Promise.all([
      client.query(`
        SELECT wo.*, c.first_name, c.last_name, c.phone, c.email,
               v.year, v.make, v.model, v.license_plate, v.color, v.vin, v.engine, v.fuel_type
        FROM ar_work_order wo
        LEFT JOIN ar_customer c ON c.id=wo.customer_id
        LEFT JOIN ar_vehicle v ON v.id=wo.vehicle_id
        WHERE wo.id=$1
      `, [params.id]),
      client.query(`SELECT * FROM ar_line_item WHERE work_order_id=$1 ORDER BY created_at`, [params.id]),
    ]);
    if (!woRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ work_order: woRes.rows[0], line_items: itemsRes.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const fields = ['status','technician','service_advisor','promised_time','customer_concern','inspection_complete','inspection_notes','tire_tread_mm','battery_cca','brake_pct_front','brake_pct_rear','notes','payment_method','payment_status','deposit_paid'];
  const updates = fields.filter(f => f in body);
  if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets = updates.map((f,i) => `${f}=$${i+1}`).join(',');
    const vals = updates.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ar_work_order SET ${sets} WHERE id=$${updates.length+1} RETURNING *`, [...vals, params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
