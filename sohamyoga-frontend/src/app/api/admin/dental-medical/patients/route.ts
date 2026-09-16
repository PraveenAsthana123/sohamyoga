import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const preferred_provider = searchParams.get('preferred_provider');
  const status = searchParams.get('status');
  const insurer = searchParams.get('insurer');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (search) { conds.push(`(LOWER(name) LIKE $${i} OR phone LIKE $${i} OR alberta_health_number LIKE $${i})`); vals.push(`%${search.toLowerCase()}%`); i++; }
      if (preferred_provider) { conds.push(`preferred_provider = $${i++}`); vals.push(preferred_provider); }
      if (status) { conds.push(`status = $${i++}`); vals.push(status); }
      if (insurer) { conds.push(`primary_insurer ILIKE $${i++}`); vals.push(`%${insurer}%`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM clinic_patient ${where} ORDER BY name ASC`, vals);
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
      const { rows } = await client.query(
        `INSERT INTO clinic_patient
          (name, email, phone, date_of_birth, health_card_number, alberta_health_number,
           address, city, province, gender, preferred_language, emergency_contact, emergency_phone,
           allergies, medical_alerts, primary_insurer, primary_policy_number, primary_group_number,
           secondary_insurer, secondary_policy_number, recall_interval_months, preferred_provider, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [body.name, body.email, body.phone, body.date_of_birth, body.health_card_number,
         body.alberta_health_number, body.address, body.city ?? 'Calgary', body.province ?? 'AB',
         body.gender, body.preferred_language ?? 'English', body.emergency_contact, body.emergency_phone,
         body.allergies ?? [], body.medical_alerts ?? [], body.primary_insurer, body.primary_policy_number,
         body.primary_group_number, body.secondary_insurer, body.secondary_policy_number,
         body.recall_interval_months ?? 6, body.preferred_provider, body.status ?? 'active', body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
