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
      `SELECT cl.*, cs.title AS section_title
       FROM course_lessons cl
       LEFT JOIN course_sections cs ON cs.id = cl.section_id
       WHERE cl.course_id=$1
       ORDER BY cl.order_index ASC, cl.created_at ASC`,
      [params.id]
    );
    return Response.json({ lessons: rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;
    const {
      section_id, title, lesson_type, duration_minutes, video_type,
      labels, tags, status, order_index, is_free_preview, sound_track, notes,
    } = body as {
      section_id?: string; title: string; lesson_type?: string;
      duration_minutes?: number; video_type?: string; labels?: string[];
      tags?: string[]; status?: string; order_index?: number;
      is_free_preview?: boolean; sound_track?: string; notes?: string;
    };
    if (!title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });

    let idx = order_index;
    if (idx === undefined) {
      const { rows: maxRow } = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1)::int AS max_idx FROM course_lessons WHERE course_id=$1`,
        [params.id]
      );
      idx = (maxRow[0]?.max_idx ?? -1) + 1;
    }

    // Determine video_type from duration if not provided
    let vType = video_type;
    if (!vType && duration_minutes) {
      vType = duration_minutes <= 5 ? 'short' : duration_minutes <= 20 ? 'medium' : 'long';
    }

    const { rows } = await pool.query(`
      INSERT INTO course_lessons
        (section_id, course_id, title, lesson_type, duration_minutes, video_type,
         labels, tags, status, order_index, is_free_preview, sound_track, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      section_id ?? null, params.id, title,
      lesson_type ?? 'video', duration_minutes ?? null, vType ?? 'short',
      labels ?? [], tags ?? [], status ?? 'planned', idx,
      is_free_preview ?? false, sound_track ?? null, notes ?? null,
    ]);

    // Update course total_lessons
    await pool.query(`
      UPDATE course_productions SET
        total_lessons = (SELECT COUNT(*) FROM course_lessons WHERE course_id=$1),
        total_duration_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM course_lessons WHERE course_id=$1),
        updated_at = NOW()
      WHERE id=$1
    `, [params.id]);

    return Response.json({ lesson: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
