import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const care_level = searchParams.get('care_level');
    const unit = searchParams.get('unit');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (care_level) { conditions.push(`care_level = $${idx++}`); vals.push(parseInt(care_level, 10)); }
    if (unit) { conditions.push(`unit = $${idx++}`); vals.push(unit); }
    if (status) { conditions.push(`status = $${idx++}`); vals.push(status); }
    if (search) {
      conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR room_number ILIKE $${idx} OR primary_diagnosis ILIKE $${idx})`);
      vals.push(`%${search}%`); idx++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(`SELECT *, (first_name || ' ' || last_name) AS full_name FROM sl_residents ${where} ORDER BY last_name, first_name`, vals);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(`
      INSERT INTO sl_residents (first_name, last_name, date_of_birth, admission_date, room_number, unit, care_level, primary_diagnosis, secondary_diagnoses, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, physician_name, dnr_status, aish_recipient, funding_type, daily_rate, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [b.first_name, b.last_name, b.date_of_birth || null, b.admission_date || null, b.room_number, b.unit || 'assisted', b.care_level || 3, b.primary_diagnosis, b.secondary_diagnoses || [], b.emergency_contact_name, b.emergency_contact_phone, b.emergency_contact_relation, b.physician_name, b.dnr_status || false, b.aish_recipient || false, b.funding_type || 'private', b.daily_rate || null, b.status || 'active', b.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
