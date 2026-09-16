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
    const [custRes, vehiclesRes, woRes] = await Promise.all([
      client.query(`SELECT * FROM ar_customer WHERE id=$1`, [params.id]),
      client.query(`SELECT * FROM ar_vehicle WHERE customer_id=$1 ORDER BY year DESC`, [params.id]),
      client.query(`SELECT wo.*, v.year, v.make, v.model FROM ar_work_order wo LEFT JOIN ar_vehicle v ON v.id=wo.vehicle_id WHERE wo.customer_id=$1 ORDER BY wo.created_at DESC LIMIT 20`, [params.id]),
    ]);
    if (!custRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ customer: custRes.rows[0], vehicles: vehiclesRes.rows, work_orders: woRes.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const fields = ['first_name','last_name','email','phone','address','city','province','preferred_contact','notes'];
  const updates = fields.filter(f => f in body);
  if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets = updates.map((f,i) => `${f}=$${i+1}`).join(',');
    const vals = updates.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ar_customer SET ${sets} WHERE id=$${updates.length+1} RETURNING *`, [...vals, params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
