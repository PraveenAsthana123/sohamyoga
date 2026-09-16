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
      const [custRes, dealsRes] = await Promise.all([
        client.query(`SELECT * FROM auto_customer WHERE id = $1`, [params.id]),
        client.query(`SELECT d.*, v.year, v.make, v.model FROM auto_deal d LEFT JOIN auto_vehicle_inventory v ON v.id = d.vehicle_id WHERE d.customer_id = $1 ORDER BY d.created_at DESC`, [params.id]),
      ]);
      if (!custRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ customer: custRes.rows[0], deals: dealsRes.rows });
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
        `UPDATE auto_customer SET ${sets} WHERE id = $1 RETURNING *`,
        [params.id, ...fields.map(k => body[k])]
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
