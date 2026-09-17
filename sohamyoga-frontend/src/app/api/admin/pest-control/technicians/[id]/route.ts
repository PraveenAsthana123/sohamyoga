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
    const { rows: techRows } = await client.query(`SELECT * FROM pc_technicians WHERE id = $1`, [params.id]);
    if (!techRows.length) return Response.json({ error: 'Technician not found.' }, { status: 404 });
    const { rows: jobs } = await client.query(
      `SELECT j.*, c.name AS customer_name FROM pc_jobs j
       LEFT JOIN pc_customers c ON c.id = j.customer_id
       WHERE j.technician_id = $1 ORDER BY j.scheduled_date DESC LIMIT 20`,
      [params.id]
    );
    return Response.json({ technician: techRows[0], recent_jobs: jobs });
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
    const allowed = ['name','email','phone','pesticide_license_number','license_class','license_expiry','wcb_coverage','vehicle_plate','status','notes','is_active'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in b) { sets.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(
      `UPDATE pc_technicians SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ technician: rows[0] });
  } finally {
    client.release();
  }
}
