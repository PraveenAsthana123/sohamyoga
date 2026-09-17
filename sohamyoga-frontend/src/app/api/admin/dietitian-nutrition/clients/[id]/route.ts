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
    const { id } = params;
    const [clientRes, appointments, weightHistory, plans] = await Promise.all([
      client.query(`SELECT * FROM dn_clients WHERE id = $1`, [id]),
      client.query(`SELECT a.*, d.name as dietitian_name FROM dn_appointments a LEFT JOIN dn_dietitians d ON d.id=a.dietitian_id WHERE a.client_id=$1 ORDER BY a.appointment_date DESC LIMIT 20`, [id]),
      client.query(`SELECT * FROM dn_weight_entries WHERE client_id=$1 ORDER BY recorded_at DESC LIMIT 50`, [id]),
      client.query(`SELECT * FROM dn_nutrition_plans WHERE client_id=$1 ORDER BY created_at DESC`, [id]),
    ]);
    if (!clientRes.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ client: clientRes.rows[0], appointments: appointments.rows, weight_history: weightHistory.rows, nutrition_plans: plans.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = params;
    const body = await req.json();
    const allowed = ['first_name','last_name','date_of_birth','email','phone','referral_source',
      'primary_health_condition','height_cm','weight_kg','allergies','food_intolerances',
      'medications','corporate_plan_name','status','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in body) { sets.push(`${key}=$${idx++}`); vals.push(body[key]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(id);
    const result = await client.query(`UPDATE dn_clients SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`, vals);
    return Response.json({ client: result.rows[0] });
  } finally { client.release(); }
}
