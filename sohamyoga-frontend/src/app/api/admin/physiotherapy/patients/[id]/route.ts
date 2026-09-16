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
    const { rows: [patient] } = await client.query(`SELECT * FROM pt_patient WHERE id = $1`, [params.id]);
    if (!patient) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: appointments } = await client.query(`SELECT * FROM pt_appointment WHERE patient_id = $1 ORDER BY appointment_date DESC LIMIT 20`, [params.id]);
    const { rows: plans } = await client.query(`SELECT * FROM pt_treatment_plan WHERE patient_id = $1 ORDER BY created_at DESC`, [params.id]);
    const { rows: outcomes } = await client.query(`SELECT * FROM pt_outcome_measure WHERE patient_id = $1 ORDER BY assessment_date ASC`, [params.id]);
    return Response.json({ ...patient, appointments, plans, outcomes });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','date_of_birth','health_card_number','phone','email','address','city','province','referral_source','referring_physician','injury_type','primary_diagnosis','secondary_diagnoses','date_of_injury','wca_claim_number','wca_approved','mvac_claim_number','group_benefits_provider','group_benefits_id','treatment_goals','precautions','contraindications','status'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE pt_patient SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
