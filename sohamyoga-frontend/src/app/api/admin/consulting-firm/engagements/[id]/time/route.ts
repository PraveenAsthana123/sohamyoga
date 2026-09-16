import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const billable = searchParams.get('billable');
    let query = `SELECT * FROM cf_time_entry WHERE engagement_id=$1`;
    const queryParams: unknown[] = [params.id];
    if (billable !== null) { query += ` AND billable=$2`; queryParams.push(billable === 'true'); }
    query += ` ORDER BY entry_date DESC`;
    const { rows } = await client.query(query, queryParams);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO cf_time_entry (engagement_id, consultant, entry_date, hours, activity, billable, hourly_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [params.id, body.consultant, body.entry_date || new Date().toISOString().split('T')[0],
       body.hours, body.activity, body.billable !== false, body.hourly_rate || null]
    );
    // Update actual_hours on engagement
    await client.query(`UPDATE cf_engagement SET actual_hours = actual_hours + $1 WHERE id=$2`, [body.hours, params.id]);
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
