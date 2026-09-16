import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM clinic_treatment_item WHERE plan_id = $1 ORDER BY sequence_order ASC`, [params.id]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO clinic_treatment_item (plan_id, tooth_number, surface, procedure_code, description, fee, insurance_coverage, status, sequence_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [params.id, body.tooth_number, body.surface, body.procedure_code, body.description,
         body.fee, body.insurance_coverage, body.status ?? 'pending', body.sequence_order ?? 1]
      );
      // Recalculate plan totals
      await client.query(`
        UPDATE clinic_treatment_plan SET
          total_estimated_fee = (SELECT COALESCE(SUM(fee), 0) FROM clinic_treatment_item WHERE plan_id = $1),
          insurance_coverage_estimate = (SELECT COALESCE(SUM(insurance_coverage), 0) FROM clinic_treatment_item WHERE plan_id = $1),
          patient_responsibility = (SELECT COALESCE(SUM(fee - insurance_coverage), 0) FROM clinic_treatment_item WHERE plan_id = $1)
        WHERE id = $1
      `, [params.id]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
