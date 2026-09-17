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
      `SELECT a.*, c.first_name, c.last_name, c.email, c.primary_health_condition, d.name as dietitian_name
       FROM dn_appointments a
       LEFT JOIN dn_clients c ON c.id=a.client_id
       LEFT JOIN dn_dietitians d ON d.id=a.dietitian_id
       WHERE a.id=$1`,
      [params.id]
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ appointment: result.rows[0] });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const allowed = ['appointment_type','appointment_date','start_time','duration_minutes','status',
      'weight_recorded_kg','session_notes','goals_reviewed','next_steps','follow_up_date','dietitian_id'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in body) { sets.push(`${key}=$${idx++}`); vals.push(body[key]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const result = await client.query(`UPDATE dn_appointments SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`, vals);
    return Response.json({ appointment: result.rows[0] });
  } finally { client.release(); }
}
