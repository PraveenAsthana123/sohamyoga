import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const member = await client.query(`SELECT * FROM hs_team_member WHERE id = $1`, [params.id]);
    if (!member.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const today = new Date().toISOString().slice(0, 10);
    const jobs = await client.query(
      `SELECT * FROM hs_job WHERE $1 = ANY(assigned_team) AND scheduled_at::date = $2`,
      [member.rows[0].first_name + ' ' + member.rows[0].last_name, today]
    );
    return Response.json({ ...member.rows[0], todays_jobs: jobs.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE hs_team_member SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name), phone=COALESCE($3,phone), role=COALESCE($4,role), status=COALESCE($5,status), hourly_rate=COALESCE($6,hourly_rate) WHERE id=$7 RETURNING *`,
      [b.first_name, b.last_name, b.phone, b.role, b.status, b.hourly_rate, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
