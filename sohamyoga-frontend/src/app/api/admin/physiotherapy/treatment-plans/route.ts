import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patient_id') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (patientId) { vals.push(patientId); where += ` AND tp.patient_id = $${vals.length}`; }
    const { rows } = await client.query(
      `SELECT tp.*, p.first_name, p.last_name, p.primary_diagnosis,
              (SELECT COUNT(*) FROM pt_appointment a WHERE a.patient_id = tp.patient_id AND a.status = 'completed') AS visits_completed
       FROM pt_treatment_plan tp JOIN pt_patient p ON p.id = tp.patient_id
       ${where} ORDER BY tp.created_at DESC LIMIT 100`,
      vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO pt_treatment_plan (patient_id, physio, diagnosis, treatment_goals, proposed_visits, frequency, duration_weeks, techniques_planned, expected_outcomes, discharge_criteria, wca_pre_authorized, wca_auth_visits, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.patient_id, b.physio, b.diagnosis, b.treatment_goals, b.proposed_visits ?? null, b.frequency ?? null, b.duration_weeks ?? null, b.techniques_planned ?? null, b.expected_outcomes ?? null, b.discharge_criteria ?? null, b.wca_pre_authorized ?? false, b.wca_auth_visits ?? null, b.notes ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
