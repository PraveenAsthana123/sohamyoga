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
    const { rows: customerRows } = await client.query(`SELECT * FROM pc_customers WHERE id = $1`, [params.id]);
    if (!customerRows.length) return Response.json({ error: 'Customer not found.' }, { status: 404 });
    const { rows: jobs } = await client.query(
      `SELECT j.*, t.name AS technician_name FROM pc_jobs j
       LEFT JOIN pc_technicians t ON t.id = j.technician_id
       WHERE j.customer_id = $1 ORDER BY j.scheduled_date DESC`,
      [params.id]
    );
    const { rows: agreements } = await client.query(
      `SELECT * FROM pc_service_agreements WHERE customer_id = $1 ORDER BY start_date DESC`,
      [params.id]
    );
    return Response.json({ customer: customerRows[0], jobs, agreements });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b) return Response.json({ error: 'No body.' }, { status: 400 });
    const fields = ['name','email','phone','address','property_type','account_type','service_plan','contract_start','contract_end','pet_on_property','medical_sensitivities','notes','is_active'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (f in b) { sets.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(
      `UPDATE pc_customers SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ customer: rows[0] });
  } finally {
    client.release();
  }
}
