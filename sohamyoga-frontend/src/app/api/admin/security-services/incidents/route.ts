import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get('severity');
    const client_id = searchParams.get('client_id');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');

    let q = `
      SELECT i.*, c.company_name, g.first_name || ' ' || g.last_name AS guard_name
      FROM sec_incident i
      LEFT JOIN sec_client c ON c.id = i.client_id
      LEFT JOIN sec_guard g ON g.id = i.guard_id
      WHERE 1=1
    `;
    const vals: string[] = [];
    let idx = 1;
    if (severity) { q += ` AND i.severity = $${idx++}`; vals.push(severity); }
    if (client_id) { q += ` AND i.client_id = $${idx++}`; vals.push(client_id); }
    if (from_date) { q += ` AND i.incident_time >= $${idx++}`; vals.push(from_date); }
    if (to_date) { q += ` AND i.incident_time <= $${idx++}`; vals.push(to_date + 'T23:59:59'); }
    q += ` ORDER BY i.incident_time DESC`;

    const { rows } = await client.query(q, vals);
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { rows } = await client.query(`
      INSERT INTO sec_incident (shift_id, client_id, guard_id, incident_type, severity, incident_time, location, description, action_taken, police_called, police_report_number, witnesses, follow_up_required, follow_up_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      body.shift_id ?? null, body.client_id ?? null, body.guard_id ?? null,
      body.incident_type, body.severity ?? 'low',
      body.incident_time, body.location ?? null, body.description,
      body.action_taken ?? null, body.police_called ?? false,
      body.police_report_number ?? null, body.witnesses ?? null,
      body.follow_up_required ?? false, body.follow_up_notes ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
