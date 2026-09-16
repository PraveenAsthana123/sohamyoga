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
    const date = searchParams.get('date') ?? '';
    const optometrist = searchParams.get('optometrist') ?? '';
    const examType = searchParams.get('exam_type') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (date) { vals.push(date); where += ` AND e.exam_date = $${vals.length}`; }
    if (optometrist) { vals.push(`%${optometrist}%`); where += ` AND e.optometrist ILIKE $${vals.length}`; }
    if (examType) { vals.push(examType); where += ` AND e.exam_type = $${vals.length}`; }
    const { rows } = await client.query(
      `SELECT e.*, p.first_name, p.last_name, p.phone, p.email
       FROM opt_exam e JOIN opt_patient p ON p.id = e.patient_id
       ${where} ORDER BY e.exam_date DESC, e.created_at DESC LIMIT 200`,
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
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO opt_exam (patient_id, exam_date, optometrist, exam_type, chief_complaint,
        od_sphere, od_cylinder, od_axis, od_add, od_prism,
        os_sphere, os_cylinder, os_axis, os_add, os_prism,
        od_visual_acuity, os_visual_acuity, binocular_va, od_iop, os_iop,
        pupil_distance, near_pd, diagnosis, recommendations, lens_type,
        contact_lens_brand, follow_up_required, follow_up_weeks, alberta_health_covered,
        total_fee, insurance_claimed, patient_paid, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33) RETURNING *`,
      [b.patient_id, b.exam_date, b.optometrist, b.exam_type ?? 'comprehensive', b.chief_complaint ?? null,
       b.od_sphere ?? null, b.od_cylinder ?? null, b.od_axis ?? null, b.od_add ?? null, b.od_prism ?? null,
       b.os_sphere ?? null, b.os_cylinder ?? null, b.os_axis ?? null, b.os_add ?? null, b.os_prism ?? null,
       b.od_visual_acuity ?? null, b.os_visual_acuity ?? null, b.binocular_va ?? null, b.od_iop ?? null, b.os_iop ?? null,
       b.pupil_distance ?? null, b.near_pd ?? null, b.diagnosis ?? null, b.recommendations ?? null, b.lens_type ?? null,
       b.contact_lens_brand ?? null, b.follow_up_required ?? false, b.follow_up_weeks ?? null, b.alberta_health_covered ?? true,
       b.total_fee ?? null, b.insurance_claimed ?? null, b.patient_paid ?? null, b.notes ?? null]
    );
    // Update patient last_exam_date and next_recall_date
    await client.query(
      `UPDATE opt_patient SET last_exam_date = $1, next_recall_date = $1::DATE + (recall_interval_months || ' months')::INTERVAL WHERE id = $2`,
      [b.exam_date, b.patient_id]
    );
    await client.query('COMMIT');
    return Response.json(rows[0], { status: 201 });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
