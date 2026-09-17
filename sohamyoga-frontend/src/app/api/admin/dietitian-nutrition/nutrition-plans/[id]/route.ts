import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.*, c.first_name, c.last_name, c.primary_health_condition, d.name as dietitian_name
       FROM dn_nutrition_plans p
       LEFT JOIN dn_clients c ON c.id=p.client_id
       LEFT JOIN dn_dietitians d ON d.id=p.dietitian_id
       WHERE p.id=$1`,
      [params.id]
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ nutrition_plan: result.rows[0] });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const allowed = ['plan_name','plan_type','calorie_target','protein_target_g','carb_target_g',
      'fat_target_g','key_recommendations','foods_to_limit','supplement_recommendations',
      'review_date','status','dietitian_id'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in body) { sets.push(`${key}=$${idx++}`); vals.push(body[key]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const result = await client.query(`UPDATE dn_nutrition_plans SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`, vals);
    return Response.json({ nutrition_plan: result.rows[0] });
  } finally { client.release(); }
}
