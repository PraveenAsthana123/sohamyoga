import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT d.*, c.name AS customer_name, c.phone AS customer_phone,
           v.year, v.make, v.model, v.trim, v.stock_number
         FROM auto_deal d
         LEFT JOIN auto_customer c ON c.id = d.customer_id
         LEFT JOIN auto_vehicle_inventory v ON v.id = d.vehicle_id
         WHERE d.id = $1`,
        [params.id]
      );
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const { rows } = await client.query(
        `UPDATE auto_deal SET ${sets} WHERE id = $1 RETURNING *`,
        [params.id, ...fields.map(k => body[k])]
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
