import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { instructor_notes, skills_covered } = body;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: lessonRows } = await client.query(
      `UPDATE ds_lessons SET status = 'completed', instructor_notes = COALESCE($1, instructor_notes), skills_covered = COALESCE($2, skills_covered)
       WHERE id = $3 AND status != 'completed' RETURNING student_id`,
      [instructor_notes || null, skills_covered ? skills_covered : null, params.id],
    );

    if (!lessonRows.length) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Lesson not found or already completed' }, { status: 404 });
    }

    const studentId = lessonRows[0].student_id;
    const { rows: studentRows } = await client.query(
      `UPDATE ds_students SET lessons_completed = lessons_completed + 1 WHERE id = $1 RETURNING lessons_completed, lessons_purchased`,
      [studentId],
    );

    await client.query('COMMIT');

    const s = studentRows[0];
    return Response.json({
      success: true,
      lessons_completed: s.lessons_completed,
      lessons_remaining: Math.max(0, s.lessons_purchased - s.lessons_completed),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
