import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const customer = await client.query(`SELECT * FROM pool_customers WHERE id = $1`, [params.id]);
    if (!customer.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const history = await client.query(
      `SELECT sv.*, c.name AS customer_name FROM pool_service_visits sv
       LEFT JOIN pool_customers c ON c.id = sv.customer_id
       WHERE sv.customer_id = $1 ORDER BY sv.visit_date DESC LIMIT 50`,
      [params.id]
    );
    const equipment = await client.query(
      `SELECT * FROM pool_equipment WHERE customer_id = $1 ORDER BY install_date DESC`,
      [params.id]
    );
    return Response.json({ customer: customer.rows[0], service_history: history.rows, equipment: equipment.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const fields = ['name', 'email', 'phone', 'address', 'pool_type', 'pool_size_gallons', 'hot_tub_brand', 'service_plan', 'contract_start', 'contract_end', 'notes', 'is_active'];
    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(body[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);
    const row = await client.query(
      `UPDATE pool_customers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ customer: row.rows[0] });
  } finally {
    client.release();
  }
}
