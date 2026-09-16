import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await client.query(
      `SELECT
         t.teacher,
         COUNT(DISTINCT s.id) AS student_count,
         COUNT(DISTINCT l.id) AS total_lessons,
         COUNT(DISTINCT CASE WHEN l.lesson_date=$1 THEN l.id END) AS lessons_today,
         COUNT(DISTINCT CASE WHEN l.status='completed' AND DATE_TRUNC('month',l.lesson_date)=DATE_TRUNC('month',NOW()) THEN l.id END) AS completed_mtd,
         COUNT(DISTINCT CASE WHEN l.status='teacher_absent' THEN l.id END) AS absences,
         ARRAY_AGG(DISTINCT s.instrument) FILTER (WHERE s.instrument IS NOT NULL) AS instruments
       FROM (
         SELECT DISTINCT teacher FROM ms_student WHERE teacher IS NOT NULL
         UNION
         SELECT DISTINCT teacher FROM ms_lesson WHERE teacher IS NOT NULL
       ) t
       LEFT JOIN ms_student s ON s.teacher=t.teacher AND s.status='active'
       LEFT JOIN ms_lesson l ON l.teacher=t.teacher
       GROUP BY t.teacher ORDER BY t.teacher`,
      [today]
    );
    return Response.json({ teachers: r.rows });
  } finally {
    client.release();
  }
}
