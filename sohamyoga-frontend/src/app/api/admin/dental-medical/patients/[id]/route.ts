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
      const [patRes, apptRes, planRes, recallRes] = await Promise.all([
        client.query(`SELECT * FROM clinic_patient WHERE id = $1`, [params.id]),
        client.query(`SELECT * FROM clinic_appointment WHERE patient_id = $1 ORDER BY appointment_date DESC LIMIT 20`, [params.id]),
        client.query(`SELECT * FROM clinic_treatment_plan WHERE patient_id = $1 ORDER BY created_at DESC`, [params.id]),
        client.query(`SELECT * FROM clinic_recall WHERE patient_id = $1 ORDER BY due_date DESC`, [params.id]),
      ]);
      if (!patRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ patient: patRes.rows[0], appointments: apptRes.rows, treatment_plans: planRes.rows, recalls: recallRes.rows });
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
        `UPDATE clinic_patient SET ${sets} WHERE id = $1 RETURNING *`,
        [params.id, ...fields.map(k => body[k])]
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
