import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const status = req.nextUrl.searchParams.get('status');
    const patientId = req.nextUrl.searchParams.get('patient_id');
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (status) { values.push(status); conditions.push(`p.status = $${values.length}`); }
    if (patientId) { values.push(patientId); conditions.push(`p.patient_id = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT p.*, pat.first_name, pat.last_name, pat.allergies
       FROM rx_prescription p
       JOIN rx_patient pat ON pat.id = p.patient_id
       ${where}
       ORDER BY p.created_at DESC LIMIT 200`,
      values
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO rx_prescription (patient_id,din,drug_name,brand_name,strength,form,quantity,days_supply,refills_authorized,refills_remaining,directions,prescriber_name,prescriber_license,prescriber_phone,written_date,status,patient_cost,insurance_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [b.patient_id, b.din, b.drug_name, b.brand_name, b.strength, b.form, b.quantity, b.days_supply,
       b.refills_authorized ?? 0, b.directions, b.prescriber_name, b.prescriber_license,
       b.prescriber_phone, b.written_date, b.status ?? 'new', b.patient_cost, b.insurance_paid]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
