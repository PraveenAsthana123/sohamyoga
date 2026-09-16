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
    const id = parseInt(params.id);
    const [patient, visits, plans, xrays] = await Promise.all([
      client.query(`SELECT * FROM chiro_patient WHERE id=$1`, [id]),
      client.query(`SELECT * FROM chiro_visit WHERE patient_id=$1 ORDER BY visit_date DESC, visit_time DESC LIMIT 50`, [id]),
      client.query(`SELECT * FROM chiro_treatment_plan WHERE patient_id=$1 ORDER BY created_at DESC`, [id]),
      client.query(`SELECT * FROM chiro_xray WHERE patient_id=$1 ORDER BY xray_date DESC`, [id]),
    ]);
    if (!patient.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...patient.rows[0], visits: visits.rows, treatment_plans: plans.rows, xrays: xrays.rows });
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
    const id = parseInt(params.id);
    const b = await req.json();
    const fields = Object.entries(b).filter(([k]) => k !== 'id').map(([k], i) => `${k}=$${i + 2}`);
    const values = Object.values(b).filter((_, i) => Object.keys(b)[i] !== 'id');
    const { rows } = await client.query(
      `UPDATE chiro_patient SET ${fields.join(',')} WHERE id=$1 RETURNING *`,
      [id, ...values]
    );
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
