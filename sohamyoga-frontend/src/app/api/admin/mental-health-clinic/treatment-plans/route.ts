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
    const client_id = searchParams.get('client_id');
    const vals: unknown[] = [];
    const where = client_id ? `WHERE tp.client_id = $1` : '';
    if (client_id) vals.push(client_id);
    const { rows } = await client.query(
      `SELECT tp.*, c.first_name, c.last_name, c.risk_level FROM mh_treatment_plan tp JOIN mh_client c ON c.id = tp.client_id ${where} ORDER BY tp.created_at DESC`,
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
      `INSERT INTO mh_treatment_plan (client_id, therapist, created_date, diagnoses, treatment_goals, modalities_planned, session_frequency, proposed_sessions, strengths, barriers, crisis_plan, risk_factors, protective_factors, review_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [b.client_id, b.therapist, b.created_date || null, b.diagnoses || null, b.treatment_goals || [], b.modalities_planned || null, b.session_frequency || null, b.proposed_sessions || null, b.strengths || null, b.barriers || null, b.crisis_plan || null, b.risk_factors || null, b.protective_factors || null, b.review_date || null, b.status || 'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
