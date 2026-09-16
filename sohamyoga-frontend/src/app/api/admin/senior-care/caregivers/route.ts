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
      const status = searchParams.get('status');
      const vals: unknown[] = [];
      let where = '';
      if (status) { vals.push(status); where = `WHERE status=$1`; }
      const { rows } = await client.query(`SELECT * FROM sc_caregiver ${where} ORDER BY first_name`, vals);
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
    const { first_name, last_name, email, phone, certification = [], languages = [], availability_days = [], status = 'active', hourly_rate } = body;
    if (!first_name || !last_name || !phone) return Response.json({ error: 'first_name, last_name, phone required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO sc_caregiver (first_name, last_name, email, phone, certification, languages, availability_days, status, hourly_rate)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [first_name, last_name, email, phone, certification, languages, availability_days, status, hourly_rate || null]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
