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
    const physio = searchParams.get('physio') ?? '';
    const status = searchParams.get('status') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (date) { vals.push(date); where += ` AND a.appointment_date = $${vals.length}`; }
    if (physio) { vals.push(`%${physio}%`); where += ` AND a.physio ILIKE $${vals.length}`; }
    if (status) { vals.push(status); where += ` AND a.status = $${vals.length}`; }
    const { rows } = await client.query(
      `SELECT a.*, p.first_name, p.last_name, p.phone, p.primary_diagnosis, p.wca_claim_number, p.mvac_claim_number
       FROM pt_appointment a JOIN pt_patient p ON p.id = a.patient_id
       ${where} ORDER BY a.appointment_date DESC, a.start_time ASC LIMIT 200`,
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
      `INSERT INTO pt_appointment (patient_id, physio, appointment_date, start_time, end_time, treatment_type, status, wca_visit, mvac_visit, fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [b.patient_id, b.physio, b.appointment_date, b.start_time, b.end_time, b.treatment_type, b.status ?? 'scheduled', b.wca_visit ?? false, b.mvac_visit ?? false, b.fee ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
