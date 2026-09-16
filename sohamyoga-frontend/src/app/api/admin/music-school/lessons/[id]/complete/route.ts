import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE ms_lesson
       SET status='completed',
           repertoire=$1,
           technique_focus=$2,
           homework_assigned=$3,
           attendance_noted=true
       WHERE id=$4 RETURNING *`,
      [body.repertoire||null, body.technique_focus||null, body.homework_assigned||null, params.id]
    );
    if (!r.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ lesson: r.rows[0] });
  } finally {
    client.release();
  }
}
