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
      const [studentRow, sessions, assessments] = await Promise.all([
        client.query(`SELECT * FROM tc_student WHERE id=$1`, [params.id]),
        client.query(`SELECT * FROM tc_session WHERE student_id=$1 ORDER BY session_date DESC, start_time DESC LIMIT 20`, [params.id]),
        client.query(`SELECT * FROM tc_assessment WHERE student_id=$1 ORDER BY assessment_date DESC`, [params.id]),
      ]);
      if (!studentRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...studentRow.rows[0], session_history: sessions.rows, assessments: assessments.rows });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = Object.keys(body).filter(k => k !== 'id');
      if (!fields.length) return Response.json({ error: 'No fields' }, { status: 400 });
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(',');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE tc_student SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...vals]);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
