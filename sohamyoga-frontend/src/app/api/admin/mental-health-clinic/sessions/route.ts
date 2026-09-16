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
    const date = searchParams.get('date');
    const therapist = searchParams.get('therapist');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (date) { conditions.push(`s.session_date = $${idx++}`); vals.push(date); }
    if (therapist) { conditions.push(`s.therapist = $${idx++}`); vals.push(therapist); }
    if (type) { conditions.push(`s.session_type = $${idx++}`); vals.push(type); }
    if (status) { conditions.push(`s.status = $${idx++}`); vals.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // NO clinical note content in list — only scheduling/billing metadata
    const { rows } = await client.query(
      `SELECT s.id, s.client_id, s.therapist, s.session_date, s.start_time, s.end_time, s.session_type,
              s.status, s.fee, s.extended_health_claimed, s.eap_claimed, s.patient_paid,
              c.first_name, c.last_name, c.risk_level, c.eap_provider
       FROM mh_session s JOIN mh_client c ON c.id = s.client_id
       ${where} ORDER BY s.session_date DESC, s.start_time DESC`,
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
      `INSERT INTO mh_session (client_id, therapist, session_date, start_time, end_time, session_type, modality, status, fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, client_id, therapist, session_date, session_type, status`,
      [b.client_id, b.therapist, b.session_date, b.start_time, b.end_time, b.session_type || 'individual', b.modality || null, b.status || 'scheduled', b.fee || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
