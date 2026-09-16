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
    const date = searchParams.get('date');
    const stylist = searchParams.get('stylist');
    const status = searchParams.get('status');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let where = 'WHERE 1=1';
      if (date) { params.push(date); where += ` AND sa.appointment_at::date=$${params.length}`; }
      if (stylist) { params.push(stylist); where += ` AND sa.stylist=$${params.length}`; }
      if (status) { params.push(status); where += ` AND sa.status=$${params.length}`; }
      const { rows } = await client.query(`
        SELECT sa.*, sc.first_name, sc.last_name, sc.phone, sc.email, sc.loyalty_points,
               ss.name AS service_name, ss.category, ss.duration_minutes
        FROM salon_appointment sa
        LEFT JOIN salon_client sc ON sc.id=sa.client_id
        LEFT JOIN salon_service ss ON ss.id=sa.service_id
        ${where} ORDER BY sa.appointment_at ASC LIMIT 200
      `, params);
      return Response.json({ appointments: rows });
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
    const { client_id, service_id, stylist, appointment_at, notes } = body;
    if (!client_id || !stylist || !appointment_at) return Response.json({ error: 'client_id, stylist, appointment_at required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Basic availability check: no other appointment for same stylist within 15 min
      const serviceRes = service_id ? await client.query(`SELECT duration_minutes, price FROM salon_service WHERE id=$1`, [service_id]) : null;
      const duration = serviceRes?.rows[0]?.duration_minutes ?? 60;
      const conflict = await client.query(`
        SELECT id FROM salon_appointment
        WHERE stylist=$1 AND status NOT IN ('cancelled','no_show')
        AND appointment_at BETWEEN $2::timestamptz - INTERVAL '${duration} minutes' AND $2::timestamptz + INTERVAL '${duration} minutes'
        LIMIT 1
      `, [stylist, appointment_at]);
      if (conflict.rows.length > 0) return Response.json({ error: 'Stylist has a conflicting appointment at this time', conflict: true }, { status: 409 });
      const { rows } = await client.query(
        `INSERT INTO salon_appointment (client_id,service_id,stylist,appointment_at,notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [client_id, service_id ?? null, stylist, appointment_at, notes ?? null]
      );
      return Response.json({ appointment: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
