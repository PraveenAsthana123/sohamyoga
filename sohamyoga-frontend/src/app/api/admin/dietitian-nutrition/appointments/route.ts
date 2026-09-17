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
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (client_id) { conditions.push(`a.client_id=$${idx++}`); params.push(client_id); }
    if (date) { conditions.push(`a.appointment_date=$${idx++}`); params.push(date); }
    if (status) { conditions.push(`a.status=$${idx++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(
      `SELECT a.*, c.first_name, c.last_name, c.email, c.phone, c.primary_health_condition, d.name as dietitian_name
       FROM dn_appointments a
       LEFT JOIN dn_clients c ON c.id=a.client_id
       LEFT JOIN dn_dietitians d ON d.id=a.dietitian_id
       ${where} ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 200`,
      params
    );
    return Response.json({ appointments: result.rows });
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
      client_id, dietitian_id, appointment_type, appointment_date, start_time,
      duration_minutes, status, session_notes, goals_reviewed, next_steps, follow_up_date,
    } = body;

    const result = await client.query(
      `INSERT INTO dn_appointments (client_id,dietitian_id,appointment_type,appointment_date,start_time,
        duration_minutes,status,session_notes,goals_reviewed,next_steps,follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [client_id, dietitian_id||null, appointment_type||'follow_up', appointment_date, start_time,
       duration_minutes||60, status||'scheduled', session_notes||null,
       goals_reviewed||[], next_steps||[], follow_up_date||null]
    );
    return Response.json({ appointment: result.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
