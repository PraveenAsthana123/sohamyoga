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
    const row = await client.query(
      `SELECT sv.*, c.name AS customer_name, c.address AS customer_address, c.pool_type, c.pool_size_gallons
       FROM pool_service_visits sv
       LEFT JOIN pool_customers c ON c.id = sv.customer_id
       WHERE sv.id = $1`,
      [params.id]
    );
    if (!row.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ visit: row.rows[0] });
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
    const fields = ['technician_name', 'visit_date', 'visit_type', 'status', 'ph_level', 'chlorine_ppm', 'alkalinity_ppm', 'calcium_hardness', 'notes', 'labour_hours', 'labour_rate', 'parts_cost', 'total_amount'];
    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(body[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);
    const row = await client.query(
      `UPDATE pool_service_visits SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ visit: row.rows[0] });
  } finally {
    client.release();
  }
}
