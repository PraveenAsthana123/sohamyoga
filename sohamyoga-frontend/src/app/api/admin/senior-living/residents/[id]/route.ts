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
    const { rows: [resident] } = await client.query(`SELECT * FROM sl_residents WHERE id = $1`, [params.id]);
    if (!resident) return Response.json({ error: 'Not found' }, { status: 404 });
    const [assessments, incidents, medications] = await Promise.all([
      client.query(`SELECT * FROM sl_care_assessments WHERE resident_id = $1 ORDER BY assessment_date DESC LIMIT 10`, [params.id]),
      client.query(`SELECT * FROM sl_incidents WHERE resident_id = $1 ORDER BY occurred_at DESC LIMIT 10`, [params.id]),
      client.query(`SELECT * FROM sl_medications WHERE resident_id = $1 AND is_active = true ORDER BY drug_name`, [params.id]),
    ]);
    return Response.json({ ...resident, assessments: assessments.rows, incidents: incidents.rows, medications: medications.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','date_of_birth','admission_date','room_number','unit','care_level','primary_diagnosis','secondary_diagnoses','emergency_contact_name','emergency_contact_phone','emergency_contact_relation','physician_name','dnr_status','aish_recipient','funding_type','daily_rate','status','notes'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sl_residents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
