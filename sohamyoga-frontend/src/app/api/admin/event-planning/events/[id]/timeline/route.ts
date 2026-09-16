import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM ep_timeline WHERE event_id=$1 ORDER BY time_slot`, [params.id]);
      return Response.json({ timeline: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { time_slot, activity, responsible_party, duration_minutes = 30, notes } = body;
    if (!time_slot || !activity) return Response.json({ error: 'time_slot, activity required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ep_timeline (event_id,time_slot,activity,responsible_party,duration_minutes,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [params.id, time_slot, activity, responsible_party ?? null, duration_minutes, notes ?? null]
      );
      return Response.json({ item: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
