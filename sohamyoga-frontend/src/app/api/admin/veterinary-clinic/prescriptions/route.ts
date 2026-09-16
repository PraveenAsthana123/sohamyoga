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
      const { searchParams } = new URL(req.url);
      const patient_id = searchParams.get('patient_id');
      const vals: unknown[] = [];
      let where = '';
      if (patient_id) { vals.push(parseInt(patient_id)); where = `WHERE rx.patient_id=$1`; }
      const { rows } = await client.query(`
        SELECT rx.*, p.name AS patient_name, p.species, o.first_name AS owner_first, o.last_name AS owner_last
        FROM vet_prescription rx
        LEFT JOIN vet_patient p ON p.id=rx.patient_id
        LEFT JOIN vet_owner o ON o.id=p.owner_id
        ${where}
        ORDER BY rx.prescribed_date DESC
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { patient_id, appointment_id, medication_name, dosage, frequency, duration_days, refills_remaining = 0, prescribed_by, notes } = body;
    if (!patient_id || !medication_name || !dosage || !frequency) return Response.json({ error: 'patient_id, medication_name, dosage, frequency required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO vet_prescription (patient_id, appointment_id, medication_name, dosage, frequency, duration_days, refills_remaining, prescribed_by, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [patient_id, appointment_id || null, medication_name, dosage, frequency, duration_days || null, refills_remaining, prescribed_by, notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
