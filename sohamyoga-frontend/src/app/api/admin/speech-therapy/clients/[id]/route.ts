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
    const id = parseInt(params.id);
    const [stClient, sessions, goals, assessments] = await Promise.all([
      client.query(`SELECT * FROM st_client WHERE id=$1`, [id]),
      client.query(`SELECT * FROM st_session WHERE client_id=$1 ORDER BY session_date DESC, start_time DESC LIMIT 50`, [id]),
      client.query(`SELECT * FROM st_goal WHERE client_id=$1 ORDER BY created_at DESC`, [id]),
      client.query(`SELECT * FROM st_assessment WHERE client_id=$1 ORDER BY assessment_date DESC`, [id]),
    ]);
    if (!stClient.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...stClient.rows[0], sessions: sessions.rows, goals: goals.rows, assessments: assessments.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const b = await req.json();
    const fields = Object.entries(b).filter(([k]) => k !== 'id').map(([k], i) => `${k}=$${i + 2}`);
    const values = Object.entries(b).filter(([k]) => k !== 'id').map(([, v]) => v);
    const { rows } = await client.query(`UPDATE st_client SET ${fields.join(',')} WHERE id=$1 RETURNING *`, [id, ...values]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
