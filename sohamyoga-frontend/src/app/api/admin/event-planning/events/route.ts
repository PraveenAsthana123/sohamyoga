import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const date_from = searchParams.get('date_from');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let where = 'WHERE 1=1';
      if (status) { params.push(status); where += ` AND status=$${params.length}`; }
      if (type) { params.push(type); where += ` AND event_type=$${params.length}`; }
      if (date_from) { params.push(date_from); where += ` AND event_date >= $${params.length}`; }
      const { rows } = await client.query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM ep_vendor WHERE event_id=e.id) AS vendor_count,
          (SELECT COUNT(*) FROM ep_task WHERE event_id=e.id AND status NOT IN ('completed')) AS open_tasks
        FROM ep_event e ${where} ORDER BY event_date ASC LIMIT 200
      `, params);
      return Response.json({ events: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, event_type, client_name, client_email, client_phone, event_date, event_time, venue, venue_address, guest_count = 0, budget, status = 'inquiry', theme, catering, notes } = body;
    if (!name || !event_type || !client_name || !event_date) return Response.json({ error: 'name, event_type, client_name, event_date required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ep_event (name,event_type,client_name,client_email,client_phone,event_date,event_time,venue,venue_address,guest_count,budget,status,theme,catering,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [name, event_type, client_name, client_email ?? null, client_phone ?? null, event_date, event_time ?? null, venue ?? null, venue_address ?? null, guest_count, budget ?? null, status, theme ?? null, catering ?? null, notes ?? null]
      );
      return Response.json({ event: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
