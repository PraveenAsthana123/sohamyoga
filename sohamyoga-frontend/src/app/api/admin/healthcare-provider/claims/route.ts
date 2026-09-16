export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const insurer = searchParams.get('insurer');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('date_from');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (insurer) { where.push(`c.insurer ILIKE $${i++}`); params.push(`%${insurer}%`); }
    if (status) { where.push(`c.status=$${i++}`); params.push(status); }
    if (dateFrom) { where.push(`c.submitted_date >= $${i++}`); params.push(dateFrom); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT c.*, hp.name AS patient_name, hp.insurance_provider AS patient_insurer
      FROM healthcare_claim c
      LEFT JOIN healthcare_patient hp ON hp.id=c.patient_id
      ${wStr}
      ORDER BY c.created_at DESC LIMIT 200
    `, params);

    return Response.json({ claims: rows.rows });
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
    const { appointment_id, patient_id, insurer, policy_number, claim_amount, notes } = body;
    if (!patient_id || !claim_amount) {
      return Response.json({ error: 'patient_id, claim_amount required' }, { status: 400 });
    }

    const r = await client.query(`
      INSERT INTO healthcare_claim (appointment_id,patient_id,insurer,policy_number,claim_amount,notes,submitted_date)
      VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE) RETURNING *
    `, [appointment_id, patient_id, insurer, policy_number, claim_amount, notes]);

    return Response.json({ claim: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
