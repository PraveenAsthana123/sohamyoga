export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const provider = searchParams.get('provider');
  const insurance = searchParams.get('insurance_provider');
  const q = searchParams.get('q');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (status) { where.push(`p.status=$${i++}`); params.push(status); }
    if (provider) { where.push(`p.preferred_provider ILIKE $${i++}`); params.push(`%${provider}%`); }
    if (insurance) { where.push(`p.insurance_provider ILIKE $${i++}`); params.push(`%${insurance}%`); }
    if (q) { where.push(`(p.name ILIKE $${i++} OR p.email ILIKE $${i-1} OR p.health_card_number ILIKE $${i-1})`); params.push(`%${q}%`); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT p.*,
        (SELECT MAX(appointment_date) FROM healthcare_appointment WHERE patient_id=p.id AND status='completed') AS last_visit,
        (SELECT COUNT(*) FROM healthcare_appointment WHERE patient_id=p.id) AS appointment_count
      FROM healthcare_patient p
      ${wStr}
      ORDER BY p.created_at DESC
      LIMIT 200
    `, params);

    return Response.json({ patients: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, email, phone, date_of_birth, health_card_number, province, alberta_health_number,
      emergency_contact, emergency_phone, allergies, medications, conditions,
      insurance_provider, insurance_policy_number, insurance_group_number,
      status, preferred_provider, notes } = body;

    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO healthcare_patient (name,email,phone,date_of_birth,health_card_number,province,alberta_health_number,
        emergency_contact,emergency_phone,allergies,medications,conditions,
        insurance_provider,insurance_policy_number,insurance_group_number,status,preferred_provider,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [name,email,phone,date_of_birth,health_card_number,province||'AB',alberta_health_number,
        emergency_contact,emergency_phone,allergies||[],medications||[],conditions||[],
        insurance_provider,insurance_policy_number,insurance_group_number,status||'active',preferred_provider,notes]);

    return Response.json({ patient: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
