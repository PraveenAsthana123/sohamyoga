import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? '';
  const teacher = searchParams.get('teacher') ?? '';
  const student_id = searchParams.get('student_id') ?? '';
  const status = searchParams.get('status') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (date) { conditions.push(`l.lesson_date=$${values.length+1}`); values.push(date); }
    if (teacher) { conditions.push(`l.teacher=$${values.length+1}`); values.push(teacher); }
    if (student_id) { conditions.push(`l.student_id=$${values.length+1}`); values.push(student_id); }
    if (status) { conditions.push(`l.status=$${values.length+1}`); values.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(
      `SELECT l.*,s.first_name,s.last_name,s.instrument,s.skill_level
       FROM ms_lesson l
       LEFT JOIN ms_student s ON s.id=l.student_id
       ${where} ORDER BY l.lesson_date DESC,l.start_time`,
      values
    );
    return Response.json({ lessons: result.rows });
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
      `INSERT INTO ms_lesson (student_id,lesson_date,start_time,end_time,teacher,status,repertoire,technique_focus,homework_assigned)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.student_id,body.lesson_date,body.start_time,body.end_time,
       body.teacher,body.status||'scheduled',
       body.repertoire||null,body.technique_focus||null,body.homework_assigned||null]
    );
    return Response.json({ lesson: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
