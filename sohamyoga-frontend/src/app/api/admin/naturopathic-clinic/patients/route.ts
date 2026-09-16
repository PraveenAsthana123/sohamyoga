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
    const naturopath = searchParams.get('naturopath');
    const diet = searchParams.get('diet');
    const search = searchParams.get('search');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`p.status = $${idx++}`); vals.push(status); }
    if (naturopath) { conditions.push(`p.naturopath = $${idx++}`); vals.push(naturopath); }
    if (diet) { conditions.push(`p.diet_type = $${idx++}`); vals.push(diet); }
    if (search) { conditions.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.phone ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT p.*, COUNT(v.id) AS visit_count
       FROM nd_patient p LEFT JOIN nd_visit v ON v.patient_id = p.id
       ${where} GROUP BY p.id ORDER BY p.created_at DESC`,
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
      `INSERT INTO nd_patient (first_name, last_name, date_of_birth, health_card_number, phone, email, address, city, province, referral_source, naturopath, chief_complaint, health_goals, health_conditions, surgeries_hospitalizations, family_history, current_medications, supplements_vitamins, allergies, food_sensitivities, diet_type, sleep_hours, exercise_frequency, stress_level, alcohol_use, smoking_status, caffeine_daily, extended_health_provider, extended_health_id, coverage_per_visit, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
       RETURNING *`,
      [b.first_name, b.last_name, b.date_of_birth, b.health_card_number || null, b.phone, b.email || null, b.address || null, b.city || 'Calgary', b.province || 'AB', b.referral_source || null, b.naturopath || null, b.chief_complaint, b.health_goals || null, b.health_conditions || null, b.surgeries_hospitalizations || null, b.family_history || null, b.current_medications || null, b.supplements_vitamins || null, b.allergies || null, b.food_sensitivities || null, b.diet_type || null, b.sleep_hours || null, b.exercise_frequency || null, b.stress_level || null, b.alcohol_use || null, b.smoking_status || null, b.caffeine_daily || null, b.extended_health_provider || null, b.extended_health_id || null, b.coverage_per_visit || null, b.status || 'active', b.notes || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
