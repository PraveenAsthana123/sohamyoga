import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(`SELECT * FROM rs_sessions WHERE id = $1`, [params.id]);
    if (!existing.length) return Response.json({ error: 'Session not found' }, { status: 404 });
    const session = existing[0];
    const body = await req.json().catch(() => ({}));
    const end_time = body.end_time || new Date().toTimeString().slice(0, 5);

    let hours_logged = 0;
    if (session.start_time) {
      const [sh, sm] = session.start_time.slice(0, 5).split(':').map(Number);
      const [eh, em] = end_time.split(':').map(Number);
      hours_logged = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    }
    const prev_hours = parseFloat(session.hours_logged) || 0;
    const delta = hours_logged - prev_hours;

    const { rows } = await client.query(
      `UPDATE rs_sessions SET end_time = $1, hours_logged = $2 WHERE id = $3 RETURNING *`,
      [end_time, hours_logged, params.id]
    );
    if (session.project_id && delta !== 0) {
      await client.query(`UPDATE rs_projects SET actual_hours = actual_hours + $1 WHERE id = $2`, [delta, session.project_id]);
    }
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
