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
    const resident_id = searchParams.get('resident_id');
    const incident_type = searchParams.get('incident_type');
    const severity = searchParams.get('severity');
    const date = searchParams.get('date');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (resident_id) { conditions.push(`i.resident_id = $${idx++}`); vals.push(resident_id); }
    if (incident_type) { conditions.push(`i.incident_type = $${idx++}`); vals.push(incident_type); }
    if (severity) { conditions.push(`i.severity = $${idx++}`); vals.push(severity); }
    if (date) { conditions.push(`DATE(i.occurred_at) = $${idx++}`); vals.push(date); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT i.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM sl_incidents i JOIN sl_residents r ON r.id = i.resident_id
       ${where} ORDER BY i.occurred_at DESC`, vals
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
    const { rows } = await client.query(`
      INSERT INTO sl_incidents (resident_id, incident_type, severity, occurred_at, location, witnessed_by, description, immediate_action, physician_notified, family_notified, ahs_reportable, outcome, staff_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.resident_id, b.incident_type, b.severity, b.occurred_at || new Date().toISOString(), b.location, b.witnessed_by, b.description, b.immediate_action, b.physician_notified || false, b.family_notified || false, b.ahs_reportable || false, b.outcome, b.staff_name]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
