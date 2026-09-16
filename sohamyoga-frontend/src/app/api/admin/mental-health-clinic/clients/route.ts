import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const therapist = searchParams.get('therapist');
    const risk_level = searchParams.get('risk_level');
    const search = searchParams.get('search');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`c.status = $${idx++}`); vals.push(status); }
    if (therapist) { conditions.push(`c.therapist = $${idx++}`); vals.push(therapist); }
    if (risk_level) { conditions.push(`c.risk_level = $${idx++}`); vals.push(risk_level); }
    if (search) { conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.phone ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // NEVER return clinical note content in list
    const { rows } = await client.query(
      `SELECT c.id, c.first_name, c.last_name, c.therapist, c.risk_level, c.status, c.presenting_concerns,
              c.eap_provider, c.eap_sessions_approved, c.safety_plan_in_place, c.extended_health_provider,
              c.aish_funded, c.therapy_modality, c.referral_source, c.created_at,
              COUNT(s.id) AS session_count
       FROM mh_client c LEFT JOIN mh_session s ON s.client_id = c.id
       ${where} GROUP BY c.id ORDER BY c.created_at DESC`,
      vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO mh_client (first_name, last_name, date_of_birth, health_card_number, phone, email, address, city, province, referral_source, eap_provider, eap_authorization_code, eap_sessions_approved, therapist, therapy_modality, presenting_concerns, risk_level, safety_plan_in_place, emergency_contact_name, emergency_contact_phone, extended_health_provider, extended_health_id, coverage_per_session, aish_funded, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING id, first_name, last_name, therapist, risk_level, status, presenting_concerns, created_at`,
      [b.first_name, b.last_name, b.date_of_birth || null, b.health_card_number || null, b.phone, b.email || null, b.address || null, b.city || 'Calgary', b.province || 'AB', b.referral_source || null, b.eap_provider || null, b.eap_authorization_code || null, b.eap_sessions_approved || null, b.therapist || null, b.therapy_modality || null, b.presenting_concerns || [], b.risk_level || 'low', b.safety_plan_in_place || false, b.emergency_contact_name || null, b.emergency_contact_phone || null, b.extended_health_provider || null, b.extended_health_id || null, b.coverage_per_session || null, b.aish_funded || false, b.status || 'active', b.notes || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
