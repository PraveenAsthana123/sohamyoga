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
      const date = searchParams.get('date');
      const vet = searchParams.get('vet_name');
      const status = searchParams.get('status');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (date) { vals.push(date); conditions.push(`DATE(a.scheduled_at)=$${vals.length}`); }
      if (vet) { vals.push(`%${vet}%`); conditions.push(`a.vet_name ILIKE $${vals.length}`); }
      if (status) { vals.push(status); conditions.push(`a.status=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT a.*, p.name AS patient_name, p.species, p.breed, p.weight_kg,
          o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
        FROM vet_appointment a
        LEFT JOIN vet_patient p ON p.id=a.patient_id
        LEFT JOIN vet_owner o ON o.id=a.owner_id
        ${where}
        ORDER BY a.scheduled_at
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
    const { patient_id, owner_id, appointment_type, scheduled_at, vet_name, status = 'scheduled', chief_complaint } = body;
    if (!patient_id || !owner_id || !appointment_type || !scheduled_at) {
      return Response.json({ error: 'patient_id, owner_id, appointment_type, scheduled_at required' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO vet_appointment (patient_id, owner_id, appointment_type, scheduled_at, vet_name, status, chief_complaint)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [patient_id, owner_id, appointment_type, scheduled_at, vet_name, status, chief_complaint]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
