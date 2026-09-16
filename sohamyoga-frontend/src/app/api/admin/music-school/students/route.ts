import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const instrument = searchParams.get('instrument') ?? '';
  const teacher = searchParams.get('teacher') ?? '';
  const status = searchParams.get('status') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (instrument) { conditions.push(`instrument=$${values.length+1}`); values.push(instrument); }
    if (teacher) { conditions.push(`teacher=$${values.length+1}`); values.push(teacher); }
    if (status) { conditions.push(`status=$${values.length+1}`); values.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(
      `SELECT id,first_name,last_name,email,phone,parent_name,parent_email,instrument,
              skill_level,lesson_type,lesson_duration,teacher,monthly_rate,enrolled_date,
              status,rcm_level,next_exam_date,practice_goal_minutes,notes,created_at
       FROM ms_student ${where} ORDER BY last_name,first_name`,
      values
    );
    return Response.json({ students: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO ms_student
        (first_name,last_name,email,phone,parent_name,parent_phone,parent_email,
         date_of_birth,instrument,skill_level,lesson_type,lesson_duration,teacher,
         monthly_rate,enrolled_date,exam_track,rcm_level,next_exam_date,
         practice_goal_minutes,emergency_contact,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [body.first_name,body.last_name,body.email,body.phone,body.parent_name,
       body.parent_phone,body.parent_email,body.date_of_birth||null,body.instrument,
       body.skill_level||'beginner',body.lesson_type||'private',body.lesson_duration||30,
       body.teacher,body.monthly_rate||null,body.enrolled_date||null,
       body.exam_track,body.rcm_level,body.next_exam_date||null,
       body.practice_goal_minutes||30,body.emergency_contact,body.notes]
    );
    return Response.json({ student: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
