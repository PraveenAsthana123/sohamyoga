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
    const [student, lessons, upcoming] = await Promise.all([
      client.query(`SELECT * FROM ms_student WHERE id=$1`, [params.id]),
      client.query(
        `SELECT id,lesson_date,start_time,end_time,teacher,status,repertoire,
                technique_focus,homework_assigned,makeup_scheduled
         FROM ms_lesson WHERE student_id=$1 ORDER BY lesson_date DESC,start_time DESC LIMIT 20`,
        [params.id]
      ),
      client.query(
        `SELECT id,lesson_date,start_time,end_time,teacher,status
         FROM ms_lesson WHERE student_id=$1 AND lesson_date>=CURRENT_DATE AND status='scheduled'
         ORDER BY lesson_date,start_time LIMIT 10`,
        [params.id]
      ),
    ]);
    if (!student.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ student: student.rows[0], lesson_history: lessons.rows, upcoming_lessons: upcoming.rows });
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
    const fields = ['first_name','last_name','email','phone','parent_name','parent_phone','parent_email',
      'instrument','skill_level','lesson_type','lesson_duration','teacher','monthly_rate',
      'status','rcm_level','next_exam_date','practice_goal_minutes','notes'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(
      `UPDATE ms_student SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return Response.json({ student: r.rows[0] });
  } finally {
    client.release();
  }
}
