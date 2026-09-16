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
    if (patientId) { vals.push(patientId); where += ` AND om.patient_id = $${vals.length}`; }
    const { rows } = await client.query(
      `SELECT om.*, p.first_name, p.last_name FROM pt_outcome_measure om JOIN pt_patient p ON p.id = om.patient_id ${where} ORDER BY om.assessment_date ASC LIMIT 200`,
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
      `INSERT INTO pt_outcome_measure (patient_id, assessment_date, physio, measure_type, score, max_score, interpretation, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.patient_id, b.assessment_date, b.physio ?? null, b.measure_type, b.score ?? null, b.max_score ?? null, b.interpretation ?? null, b.notes ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
