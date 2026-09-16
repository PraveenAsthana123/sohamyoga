export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM staff_utilization ORDER BY utilization_pct DESC');
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const utilization = body.scheduled_hours ? ((body.actual_hours || 0) / body.scheduled_hours) * 100 : 0;
    const { rows } = await client.query(
      `INSERT INTO staff_utilization (staff_name, role, period, scheduled_hours, actual_hours, utilization_pct, services_delivered)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.staff_name, body.role, body.period, body.scheduled_hours || 0, body.actual_hours || 0, utilization, body.services_delivered || 0]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
