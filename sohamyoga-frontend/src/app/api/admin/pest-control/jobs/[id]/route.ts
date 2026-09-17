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
    const { rows } = await client.query(
      `SELECT j.*, c.name AS customer_name, c.address AS customer_address, c.phone AS customer_phone,
              c.pet_on_property, c.medical_sensitivities,
              t.name AS technician_name, t.license_class, t.pesticide_license_number
       FROM pc_jobs j
       LEFT JOIN pc_customers c ON c.id = j.customer_id
       LEFT JOIN pc_technicians t ON t.id = j.technician_id
       WHERE j.id = $1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json({ job: rows[0] });
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
    const allowed = ['job_type','pest_type','status','scheduled_date','completed_date','technician_id','infestation_level','products_used','treatment_method','follow_up_required','follow_up_date','labour_hours','total_amount','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in b) {
        sets.push(`${f} = $${idx++}`);
        vals.push(f === 'products_used' && b[f] ? JSON.stringify(b[f]) : b[f]);
      }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(
      `UPDATE pc_jobs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ job: rows[0] });
  } finally {
    client.release();
  }
}
