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
    const { rows: [patient] } = await client.query(`SELECT * FROM tcm_patient WHERE id = $1`, [params.id]);
    if (!patient) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: treatments } = await client.query(`SELECT * FROM tcm_treatment WHERE patient_id = $1 ORDER BY treatment_date DESC, treatment_time DESC LIMIT 20`, [params.id]);
    const { rows: plans } = await client.query(`SELECT * FROM tcm_treatment_plan WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5`, [params.id]);
    return Response.json({ ...patient, treatments, treatment_plans: plans });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','date_of_birth','phone','email','address','city','province','referral_source','chief_complaint','secondary_complaints','tcm_constitution','tongue_diagnosis','pulse_diagnosis','health_conditions','medications','allergies','pregnancy_status','mva_claim_number','extended_health_provider','extended_health_id','coverage_per_visit','sessions_remaining','practitioner','status','notes'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE tcm_patient SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
