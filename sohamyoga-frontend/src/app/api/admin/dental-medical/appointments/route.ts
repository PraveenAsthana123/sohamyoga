import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const provider = searchParams.get('provider');
  const status = searchParams.get('status');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds = [`a.appointment_date = $1`];
      const vals: unknown[] = [date];
      let i = 2;
      if (provider) { conds.push(`a.provider_name = $${i++}`); vals.push(provider); }
      if (status) { conds.push(`a.status = $${i++}`); vals.push(status); }
      const { rows } = await client.query(
        `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, p.allergies, p.medical_alerts
         FROM clinic_appointment a
         LEFT JOIN clinic_patient p ON p.id = a.patient_id
         WHERE ${conds.join(' AND ')} ORDER BY a.appointment_time ASC NULLS LAST`,
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
      const patient_portion = (body.fee ?? 0) - (body.insurance_estimate ?? 0);
      const { rows } = await client.query(
        `INSERT INTO clinic_appointment
          (patient_id, provider_name, clinic_location, appointment_type, procedure_codes,
           appointment_date, appointment_time, duration_minutes, status, chair_number, operatory,
           notes, fee, insurance_estimate, patient_portion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [body.patient_id, body.provider_name, body.clinic_location, body.appointment_type,
         body.procedure_codes ?? [], body.appointment_date, body.appointment_time,
         body.duration_minutes ?? 60, body.status ?? 'scheduled', body.chair_number, body.operatory,
         body.notes, body.fee, body.insurance_estimate, patient_portion]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
