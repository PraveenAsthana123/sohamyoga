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
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (client_id) { conditions.push(`p.client_id=$${idx++}`); params.push(client_id); }
    if (status) { conditions.push(`p.status=$${idx++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(
      `SELECT p.*, c.first_name, c.last_name, c.primary_health_condition, d.name as dietitian_name
       FROM dn_nutrition_plans p
       LEFT JOIN dn_clients c ON c.id=p.client_id
       LEFT JOIN dn_dietitians d ON d.id=p.dietitian_id
       ${where} ORDER BY p.created_at DESC LIMIT 200`,
      params
    );
    return Response.json({ nutrition_plans: result.rows });
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
      client_id, dietitian_id, plan_name, plan_type, calorie_target, protein_target_g,
      carb_target_g, fat_target_g, key_recommendations, foods_to_limit,
      supplement_recommendations, review_date, status,
    } = body;

    const result = await client.query(
      `INSERT INTO dn_nutrition_plans (client_id,dietitian_id,plan_name,plan_type,calorie_target,
        protein_target_g,carb_target_g,fat_target_g,key_recommendations,foods_to_limit,
        supplement_recommendations,review_date,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [client_id, dietitian_id||null, plan_name, plan_type||null, calorie_target||null,
       protein_target_g||null, carb_target_g||null, fat_target_g||null,
       key_recommendations||[], foods_to_limit||[], supplement_recommendations||[],
       review_date||null, status||'active']
    );
    return Response.json({ nutrition_plan: result.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
