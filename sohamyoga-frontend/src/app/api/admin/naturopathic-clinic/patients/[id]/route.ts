import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: [patient] } = await client.query(`SELECT * FROM nd_patient WHERE id = $1`, [params.id]);
    if (!patient) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: visits } = await client.query(`SELECT id, visit_date, visit_type, status, naturopath, fee FROM nd_visit WHERE patient_id = $1 ORDER BY visit_date DESC LIMIT 20`, [params.id]);
    const { rows: labs } = await client.query(`SELECT * FROM nd_lab_order WHERE patient_id = $1 ORDER BY ordered_date DESC LIMIT 10`, [params.id]);
    const { rows: protocols } = await client.query(`SELECT * FROM nd_supplement_protocol WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5`, [params.id]);
    return Response.json({ ...patient, visits, labs, supplement_protocols: protocols });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','date_of_birth','phone','email','address','city','province','referral_source','naturopath','chief_complaint','health_goals','health_conditions','current_medications','supplements_vitamins','allergies','food_sensitivities','diet_type','sleep_hours','exercise_frequency','stress_level','extended_health_provider','extended_health_id','coverage_per_visit','status','notes'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE nd_patient SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
