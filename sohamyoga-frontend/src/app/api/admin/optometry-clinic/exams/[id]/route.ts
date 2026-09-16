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
      `SELECT e.*, p.first_name, p.last_name, p.phone, p.email, p.date_of_birth, p.insurance_provider, p.insurance_id
       FROM opt_exam e JOIN opt_patient p ON p.id = e.patient_id WHERE e.id = $1`, [params.id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['exam_date','optometrist','exam_type','chief_complaint','od_sphere','od_cylinder','od_axis','od_add','od_prism','os_sphere','os_cylinder','os_axis','os_add','os_prism','od_visual_acuity','os_visual_acuity','binocular_va','od_iop','os_iop','pupil_distance','near_pd','diagnosis','recommendations','lens_type','frame_recommendation','contact_lens_brand','contact_base_curve','contact_diameter','follow_up_required','follow_up_weeks','alberta_health_covered','additional_tests_ordered','total_fee','insurance_claimed','patient_paid','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE opt_exam SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
