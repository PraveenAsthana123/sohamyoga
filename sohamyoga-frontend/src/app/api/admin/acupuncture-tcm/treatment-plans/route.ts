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
    const patient_id = searchParams.get('patient_id');
    const vals: unknown[] = [];
    const where = patient_id ? `WHERE tp.patient_id = $1` : '';
    if (patient_id) vals.push(patient_id);
    const { rows } = await client.query(
      `SELECT tp.*, p.first_name, p.last_name, p.tcm_constitution
       FROM tcm_treatment_plan tp
       JOIN tcm_patient p ON p.id = tp.patient_id
       ${where}
       ORDER BY tp.created_at DESC`,
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
      `INSERT INTO tcm_treatment_plan (patient_id, practitioner, created_date, tcm_diagnosis, pattern, treatment_principle, acupuncture_protocol, herbal_recommendations, lifestyle_recommendations, proposed_sessions, session_frequency, expected_outcomes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.patient_id, b.practitioner || null, b.created_date || null, b.tcm_diagnosis, b.pattern, b.treatment_principle || null, b.acupuncture_protocol || null, b.herbal_recommendations || null, b.lifestyle_recommendations || null, b.proposed_sessions || null, b.session_frequency || null, b.expected_outcomes || null, b.status || 'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
