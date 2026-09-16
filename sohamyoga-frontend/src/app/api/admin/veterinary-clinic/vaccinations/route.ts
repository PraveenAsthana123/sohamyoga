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
      if (patient_id) { vals.push(parseInt(patient_id)); where = `WHERE v.patient_id=$1`; }
      const { rows } = await client.query(`
        SELECT v.*, p.name AS patient_name, p.species, o.first_name AS owner_first, o.last_name AS owner_last
        FROM vet_vaccination v
        LEFT JOIN vet_patient p ON p.id=v.patient_id
        LEFT JOIN vet_owner o ON o.id=p.owner_id
        ${where}
        ORDER BY v.administered_date DESC
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
    const { patient_id, vaccine_name, administered_date, next_due_date, administered_by, batch_number, notes } = body;
    if (!patient_id || !vaccine_name || !administered_date) return Response.json({ error: 'patient_id, vaccine_name, administered_date required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO vet_vaccination (patient_id, vaccine_name, administered_date, next_due_date, administered_by, batch_number, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [patient_id, vaccine_name, administered_date, next_due_date || null, administered_by, batch_number, notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
