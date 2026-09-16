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
    const { rows: [patient] } = await client.query(`SELECT * FROM opt_patient WHERE id = $1`, [params.id]);
    if (!patient) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: exams } = await client.query(`SELECT * FROM opt_exam WHERE patient_id = $1 ORDER BY exam_date DESC`, [params.id]);
    const { rows: orders } = await client.query(`SELECT * FROM opt_order WHERE patient_id = $1 ORDER BY created_at DESC`, [params.id]);
    return Response.json({ ...patient, exams, orders });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','date_of_birth','health_card_number','phone','email','address','city','province','postal_code','insurance_provider','insurance_id','insurance_group','occupation','family_eye_history','recall_interval_months','next_recall_date','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE opt_patient SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
