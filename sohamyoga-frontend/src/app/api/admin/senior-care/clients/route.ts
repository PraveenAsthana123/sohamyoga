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
      const care_level = searchParams.get('care_level');
      const status = searchParams.get('status');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (care_level) { vals.push(care_level); conditions.push(`care_level=$${vals.length}`); }
      if (status) { vals.push(status); conditions.push(`status=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT *, DATE_PART('year', AGE(date_of_birth)) AS age FROM sc_client ${where} ORDER BY created_at DESC
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
    const { first_name, last_name, date_of_birth, phone, address, city = 'Calgary', province = 'AB', postal_code, care_level = 'companion', primary_condition, physician_name, physician_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, preferred_language = 'English', aish_recipient = false, alberta_seniors_benefit = false, status = 'active', notes } = body;
    if (!first_name || !last_name || !emergency_contact_name || !emergency_contact_phone) {
      return Response.json({ error: 'first_name, last_name, emergency_contact_name, emergency_contact_phone required' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO sc_client (first_name, last_name, date_of_birth, phone, address, city, province, postal_code, care_level, primary_condition, physician_name, physician_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, preferred_language, aish_recipient, alberta_seniors_benefit, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *
      `, [first_name, last_name, date_of_birth || null, phone, address, city, province, postal_code, care_level, primary_condition, physician_name, physician_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, preferred_language, aish_recipient, alberta_seniors_benefit, status, notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
