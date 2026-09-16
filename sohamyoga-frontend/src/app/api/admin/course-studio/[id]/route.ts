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
    const { rows } = await pool.query(
      `SELECT * FROM course_productions WHERE id=$1`, [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const { rows: sections } = await pool.query(
      `SELECT * FROM course_sections WHERE course_id=$1 ORDER BY order_index ASC`, [params.id]
    );
    const { rows: lessons } = await pool.query(
      `SELECT * FROM course_lessons WHERE course_id=$1 ORDER BY order_index ASC`, [params.id]
    );
    const { rows: assets } = await pool.query(
      `SELECT * FROM course_assets WHERE course_id=$1 ORDER BY created_at DESC`, [params.id]
    );
    const lessonIds = lessons.map((l: { id: string }) => l.id);
    let quizzes: unknown[] = [];
    if (lessonIds.length) {
      const { rows: qRows } = await pool.query(
        `SELECT * FROM course_quizzes WHERE lesson_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
        [lessonIds]
      );
      quizzes = qRows;
    }

    // Attach lessons to sections
    const sectionsWithLessons = sections.map((s: { id: string }) => ({
      ...s,
      lessons: lessons.filter((l: { section_id: string }) => l.section_id === s.id),
    }));

    return Response.json({
      course: rows[0],
      sections: sectionsWithLessons,
      lessons,
      assets,
      quizzes,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;
    const allowed = [
      'title','subtitle','description','target_audience','learning_objectives','prerequisites',
      'category','level','language','status','thumbnail_url','promo_video_url',
      'price_cad','is_free','tags','seo_title','seo_description',
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
    vals.push(params.id);
    const { rows } = await pool.query(
      `UPDATE course_productions SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ course: rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rowCount } = await pool.query(
      `DELETE FROM course_productions WHERE id=$1`, [params.id]
    );
    if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
