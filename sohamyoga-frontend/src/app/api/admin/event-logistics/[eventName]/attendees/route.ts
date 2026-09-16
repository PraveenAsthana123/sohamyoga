export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventName: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { eventName } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM event_attendees WHERE event_name=$1 ORDER BY name', [decodeURIComponent(eventName)]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventName: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { eventName } = await params;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO event_attendees (event_name, name, email, company, badge_type, lead_score)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [decodeURIComponent(eventName), body.name, body.email, body.company, body.badge_type || 'general', body.lead_score || 0]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
