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
    const health_condition = searchParams.get('health_condition');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (health_condition) { conditions.push(`primary_health_condition ILIKE $${idx++}`); params.push(`%${health_condition}%`); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (search) { conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM dn_appointments a WHERE a.client_id = c.id) as appointment_count,
        (SELECT COUNT(*) FROM dn_nutrition_plans p WHERE p.client_id = c.id AND p.status='active') as active_plan_count
       FROM dn_clients c ${where} ORDER BY c.created_at DESC LIMIT 200`,
      params
    );
    return Response.json({ clients: result.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      first_name, last_name, date_of_birth, email, phone, referral_source,
      primary_health_condition, height_cm, weight_kg, allergies, food_intolerances,
      medications, corporate_plan_name, status, notes,
    } = body;

    const result = await client.query(
      `INSERT INTO dn_clients (first_name,last_name,date_of_birth,email,phone,referral_source,
        primary_health_condition,height_cm,weight_kg,allergies,food_intolerances,
        medications,corporate_plan_name,status,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [first_name, last_name, date_of_birth||null, email, phone, referral_source,
       primary_health_condition, height_cm||null, weight_kg||null,
       allergies||[], food_intolerances||[], medications||[],
       corporate_plan_name||null, status||'active', notes||null]
    );
    return Response.json({ client: result.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
