import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [dailyRes, outstandingRes, insuranceRes] = await Promise.all([
        client.query(`
          SELECT a.*, p.name AS patient_name
          FROM clinic_appointment a
          LEFT JOIN clinic_patient p ON p.id = a.patient_id
          WHERE a.appointment_date = CURRENT_DATE AND a.status = 'completed'
          ORDER BY a.appointment_time ASC
        `),
        client.query(`
          SELECT a.*, p.name AS patient_name, p.phone AS patient_phone
          FROM clinic_appointment a
          LEFT JOIN clinic_patient p ON p.id = a.patient_id
          WHERE a.outstanding > 0 ORDER BY a.outstanding DESC LIMIT 50
        `),
        client.query(`
          SELECT a.*, p.name AS patient_name, p.primary_insurer
          FROM clinic_appointment a
          LEFT JOIN clinic_patient p ON p.id = a.patient_id
          WHERE a.submitted_to_insurance = true AND (a.insurance_paid IS NULL OR a.insurance_paid = 0)
          ORDER BY a.appointment_date ASC LIMIT 50
        `),
      ]);
      return Response.json({ daily: dailyRes.rows, outstanding: outstandingRes.rows, insurance_pending: insuranceRes.rows });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
