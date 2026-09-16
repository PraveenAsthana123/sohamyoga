import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const date = searchParams.get('date');
      const caregiver_id = searchParams.get('caregiver_id');
      const client_id = searchParams.get('client_id');
      const status = searchParams.get('status');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (date) { vals.push(date); conditions.push(`s.visit_date=$${vals.length}`); }
      if (caregiver_id) { vals.push(parseInt(caregiver_id)); conditions.push(`s.caregiver_id=$${vals.length}`); }
      if (client_id) { vals.push(parseInt(client_id)); conditions.push(`s.client_id=$${vals.length}`); }
      if (status) { vals.push(status); conditions.push(`s.status=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT s.*, c.first_name AS client_first, c.last_name AS client_last, c.care_level,
          cg.first_name AS cg_first, cg.last_name AS cg_last
        FROM sc_schedule s
        LEFT JOIN sc_client c ON c.id=s.client_id
        LEFT JOIN sc_caregiver cg ON cg.id=s.caregiver_id
        ${where}
        ORDER BY s.visit_date, s.start_time
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { client_id, caregiver_id, visit_date, start_time, end_time, care_type, status = 'scheduled', notes } = body;
    if (!client_id || !caregiver_id || !visit_date || !start_time || !end_time || !care_type) {
      return Response.json({ error: 'client_id, caregiver_id, visit_date, start_time, end_time, care_type required' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO sc_schedule (client_id, caregiver_id, visit_date, start_time, end_time, care_type, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [client_id, caregiver_id, visit_date, start_time, end_time, care_type, status, notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
