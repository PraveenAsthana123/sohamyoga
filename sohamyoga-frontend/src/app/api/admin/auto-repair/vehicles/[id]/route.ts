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
    const [vehRes, woRes] = await Promise.all([
      client.query(`SELECT v.*, c.first_name, c.last_name, c.phone FROM ar_vehicle v LEFT JOIN ar_customer c ON c.id=v.customer_id WHERE v.id=$1`, [params.id]),
      client.query(`SELECT * FROM ar_work_order WHERE vehicle_id=$1 ORDER BY created_at DESC LIMIT 10`, [params.id]),
    ]);
    if (!vehRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ vehicle: vehRes.rows[0], work_orders: woRes.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const fields = ['year','make','model','trim','color','vin','license_plate','province','engine','transmission','odometer_km','fuel_type','insurance_expiry','registration_expiry','last_service_date','notes'];
  const updates = fields.filter(f => f in body);
  if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets = updates.map((f,i) => `${f}=$${i+1}`).join(',');
    const vals = updates.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ar_vehicle SET ${sets} WHERE id=$${updates.length+1} RETURNING *`, [...vals, params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
