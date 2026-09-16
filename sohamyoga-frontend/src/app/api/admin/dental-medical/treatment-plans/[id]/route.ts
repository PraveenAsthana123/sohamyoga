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
      const [planRes, itemRes] = await Promise.all([
        client.query(`SELECT tp.*, p.name AS patient_name FROM clinic_treatment_plan tp LEFT JOIN clinic_patient p ON p.id = tp.patient_id WHERE tp.id = $1`, [params.id]),
        client.query(`SELECT * FROM clinic_treatment_item WHERE plan_id = $1 ORDER BY sequence_order ASC`, [params.id]),
      ]);
      if (!planRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ plan: planRes.rows[0], items: itemRes.rows });
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
      const { rows } = await client.query(`UPDATE clinic_treatment_plan SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...fields.map(k => body[k])]);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
