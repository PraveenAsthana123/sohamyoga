import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT cl.*, cs.title AS section_title
       FROM course_lessons cl
       LEFT JOIN course_sections cs ON cs.id = cl.section_id
       WHERE cl.id=$1 AND cl.course_id=$2`,
      [params.lessonId, params.id]
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const { rows: quizzes } = await pool.query(
      `SELECT * FROM course_quizzes WHERE lesson_id=$1 ORDER BY created_at ASC`,
      [params.lessonId]
    );
    return Response.json({ lesson: rows[0], quizzes });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;
    const allowed = [
      'section_id','title','lesson_type','duration_minutes','video_url','video_type',
      'script_text','ai_script','hook_text','key_points','summary_text','captions_srt',
      'thumbnail_url','tags','labels','sound_track','status','order_index',
      'is_free_preview','notes',
    ];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of allowed) {
      if (key in body) {
        vals.push(body[key]);
        sets.push(`${key}=$${vals.length}`);
      }
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.lessonId, params.id);
    const { rows } = await pool.query(
      `UPDATE course_lessons SET ${sets.join(',')} WHERE id=$${vals.length - 1} AND course_id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    // Sync course totals
    await pool.query(`
      UPDATE course_productions SET
        total_duration_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM course_lessons WHERE course_id=$1),
        updated_at = NOW()
      WHERE id=$1
    `, [params.id]);

    return Response.json({ lesson: rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rowCount } = await pool.query(
      `DELETE FROM course_lessons WHERE id=$1 AND course_id=$2`,
      [params.lessonId, params.id]
    );
    if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });

    // Sync course totals
    await pool.query(`
      UPDATE course_productions SET
        total_lessons = (SELECT COUNT(*) FROM course_lessons WHERE course_id=$1),
        total_duration_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM course_lessons WHERE course_id=$1),
        updated_at = NOW()
      WHERE id=$1
    `, [params.id]);

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
