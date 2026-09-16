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
    const date = searchParams.get('date');
    let q = `SELECT * FROM ls_route WHERE 1=1`;
    const vals: string[] = [];
    if (date) { q += ` AND route_date = $1`; vals.push(date); }
    q += ` ORDER BY route_date DESC, route_name`;
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
      INSERT INTO ls_route (route_name, route_date, crew_lead, vehicle, job_ids, estimated_hours)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [body.route_name, body.route_date, body.crew_lead, body.vehicle ?? null, body.job_ids ?? [], body.estimated_hours ?? null]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
