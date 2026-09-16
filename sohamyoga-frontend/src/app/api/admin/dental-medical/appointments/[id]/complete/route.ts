import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const fee = parseFloat(body.fee ?? 0);
    const insurance_paid = parseFloat(body.insurance_paid ?? 0);
    const patient_paid = parseFloat(body.patient_paid ?? 0);
    const outstanding = fee - insurance_paid - patient_paid;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE clinic_appointment
         SET status = 'completed', treatment_notes = $2, fee = $3,
             insurance_estimate = $4, patient_portion = $5,
             submitted_to_insurance = $6, insurance_paid = $7, patient_paid = $8, outstanding = $9
         WHERE id = $1 RETURNING *`,
        [params.id, body.treatment_notes, fee, body.insurance_estimate ?? 0,
         fee - (body.insurance_estimate ?? 0), body.submitted_to_insurance ?? false,
         insurance_paid, patient_paid, outstanding]
      );
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      // Update patient last visit dates
      if (body.appointment_type === 'cleaning' || body.appointment_type === 'exam') {
        await client.query(
          `UPDATE clinic_patient SET ${body.appointment_type === 'cleaning' ? 'last_cleaning_date' : 'last_exam_date'} = CURRENT_DATE WHERE id = (SELECT patient_id FROM clinic_appointment WHERE id = $1)`,
          [params.id]
        );
      }
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
