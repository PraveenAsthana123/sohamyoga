import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        UPDATE tc_session
        SET status='completed', topics_covered=$2, homework_assigned=$3,
            student_progress=$4, session_notes=$5, parent_communication_sent=$6
        WHERE id=$1 RETURNING *
      `, [
        params.id,
        body.topics_covered || [],
        body.homework_assigned || null,
        body.student_progress || null,
        body.session_notes || null,
        body.parent_communication_sent || false,
      ]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
