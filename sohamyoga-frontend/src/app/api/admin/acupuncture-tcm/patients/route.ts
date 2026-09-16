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
    const status = searchParams.get('status');
    const practitioner = searchParams.get('practitioner');
    const constitution = searchParams.get('constitution');
    const search = searchParams.get('search');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`p.status = $${idx++}`); vals.push(status); }
    if (practitioner) { conditions.push(`p.practitioner = $${idx++}`); vals.push(practitioner); }
    if (constitution) { conditions.push(`p.tcm_constitution = $${idx++}`); vals.push(constitution); }
    if (search) { conditions.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.phone ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT p.*, COUNT(t.id) AS treatment_count
       FROM tcm_patient p
       LEFT JOIN tcm_treatment t ON t.patient_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      vals
    );
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
    const { rows } = await client.query(
      `INSERT INTO tcm_patient (first_name, last_name, date_of_birth, health_card_number, phone, email, address, city, province, referral_source, chief_complaint, secondary_complaints, tcm_constitution, tongue_diagnosis, pulse_diagnosis, health_conditions, medications, allergies, pregnancy_status, mva_claim_number, extended_health_provider, extended_health_id, coverage_per_visit, sessions_remaining, practitioner, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       RETURNING *`,
      [b.first_name, b.last_name, b.date_of_birth || null, b.health_card_number || null, b.phone, b.email || null, b.address || null, b.city || 'Calgary', b.province || 'AB', b.referral_source || null, b.chief_complaint, b.secondary_complaints || null, b.tcm_constitution || null, b.tongue_diagnosis || null, b.pulse_diagnosis || null, b.health_conditions || null, b.medications || null, b.allergies || null, b.pregnancy_status || 'not_applicable', b.mva_claim_number || null, b.extended_health_provider || null, b.extended_health_id || null, b.coverage_per_visit || null, b.sessions_remaining || null, b.practitioner || null, b.status || 'active', b.notes || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
