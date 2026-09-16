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
    const r = await client.query(
      `SELECT l.*,s.first_name,s.last_name,s.instrument,s.skill_level
       FROM ms_lesson l LEFT JOIN ms_student s ON s.id=l.student_id WHERE l.id=$1`,
      [params.id]
    );
    if (!r.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ lesson: r.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const allowed = ['status','repertoire','technique_focus','homework_assigned','attendance_noted','makeup_scheduled'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(
      `UPDATE ms_lesson SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return Response.json({ lesson: r.rows[0] });
  } finally {
    client.release();
  }
}
