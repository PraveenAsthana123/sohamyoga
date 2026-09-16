import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get('patient_id');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const where = patient_id ? `WHERE tp.patient_id = $1` : '';
      const vals = patient_id ? [patient_id] : [];
      const { rows } = await client.query(
        `SELECT tp.*, p.name AS patient_name,
           COUNT(ti.id) AS item_count,
           COUNT(ti.id) FILTER (WHERE ti.status = 'completed') AS items_completed
         FROM clinic_treatment_plan tp
         LEFT JOIN clinic_patient p ON p.id = tp.patient_id
         LEFT JOIN clinic_treatment_item ti ON ti.plan_id = tp.id
         ${where} GROUP BY tp.id, p.name ORDER BY tp.created_at DESC`,
        vals
      );
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO clinic_treatment_plan (patient_id, title, provider, total_estimated_fee, insurance_coverage_estimate, patient_responsibility, status, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [body.patient_id, body.title, body.provider, body.total_estimated_fee,
         body.insurance_coverage_estimate, body.patient_responsibility,
         body.status ?? 'proposed', body.priority ?? 'normal']
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
