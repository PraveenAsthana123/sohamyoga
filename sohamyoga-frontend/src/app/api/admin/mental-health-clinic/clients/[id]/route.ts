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
    // Return client WITHOUT detailed session notes — only session metadata + treatment plan summary
    const { rows: [mhClient] } = await client.query(
      `SELECT id, first_name, last_name, date_of_birth, phone, email, city, province,
              therapist, therapy_modality, presenting_concerns, risk_level, safety_plan_in_place,
              emergency_contact_name, emergency_contact_phone, eap_provider, eap_sessions_approved,
              extended_health_provider, coverage_per_session, aish_funded, status, notes, created_at
       FROM mh_client WHERE id = $1`,
      [params.id]
    );
    if (!mhClient) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: sessions } = await client.query(
      `SELECT id, session_date, session_type, status, therapist, start_time, end_time, fee FROM mh_session WHERE client_id = $1 ORDER BY session_date DESC LIMIT 20`,
      [params.id]
    );
    const { rows: plans } = await client.query(
      `SELECT id, created_date, diagnoses, treatment_goals, session_frequency, proposed_sessions, status, review_date FROM mh_treatment_plan WHERE client_id = $1 ORDER BY created_at DESC LIMIT 3`,
      [params.id]
    );
    const { rows: contacts } = await client.query(
      `SELECT * FROM mh_crisis_contact WHERE client_id = $1`,
      [params.id]
    );
    return Response.json({ ...mhClient, sessions, treatment_plans: plans, crisis_contacts: contacts });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','date_of_birth','phone','email','address','city','province','referral_source','eap_provider','eap_authorization_code','eap_sessions_approved','therapist','therapy_modality','presenting_concerns','risk_level','safety_plan_in_place','emergency_contact_name','emergency_contact_phone','extended_health_provider','extended_health_id','coverage_per_session','aish_funded','status','notes'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE mh_client SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, first_name, last_name, therapist, risk_level, status`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
