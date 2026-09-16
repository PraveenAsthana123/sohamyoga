import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const patient = await client.query(`SELECT * FROM rx_patient WHERE id = $1`, [params.id]);
    if (!patient.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const prescriptions = await client.query(
      `SELECT * FROM rx_prescription WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [params.id]
    );
    return Response.json({ ...patient.rows[0], prescriptions: prescriptions.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE rx_patient SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
       phone=COALESCE($3,phone), email=COALESCE($4,email), address=COALESCE($5,address),
       allergies=COALESCE($6,allergies), current_conditions=COALESCE($7,current_conditions),
       insurance_provider=COALESCE($8,insurance_provider), insurance_id=COALESCE($9,insurance_id),
       insurance_group=COALESCE($10,insurance_group), notes=COALESCE($11,notes)
       WHERE id=$12 RETURNING *`,
      [b.first_name, b.last_name, b.phone, b.email, b.address,
       b.allergies, b.current_conditions, b.insurance_provider, b.insurance_id, b.insurance_group,
       b.notes, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
