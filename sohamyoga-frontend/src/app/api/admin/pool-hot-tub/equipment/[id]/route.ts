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
      `SELECT pe.*, c.name AS customer_name, c.address AS customer_address FROM pool_equipment pe LEFT JOIN pool_customers c ON c.id = pe.customer_id WHERE pe.id = $1`,
      [params.id]
    );
    if (!row.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ equipment: row.rows[0] });
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
    const fields = ['equipment_type', 'brand', 'model', 'serial_number', 'install_date', 'warranty_expiry', 'last_service', 'next_service_due', 'condition', 'notes'];
    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(body[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);
    const row = await client.query(
      `UPDATE pool_equipment SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ equipment: row.rows[0] });
  } finally {
    client.release();
  }
}
