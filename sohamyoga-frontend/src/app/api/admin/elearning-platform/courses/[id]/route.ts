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
    const courseRes = await client.query(
      `SELECT c.*, i.first_name AS instructor_first, i.last_name AS instructor_last,
              COUNT(DISTINCT e.id) AS enrollment_count,
              COALESCE(AVG(r.rating), 0) AS computed_avg_rating
       FROM el_course c
       LEFT JOIN el_instructor i ON c.instructor_id = i.id
       LEFT JOIN el_enrollment e ON e.course_id = c.id AND e.refunded = false
       LEFT JOIN el_review r ON r.course_id = c.id
       WHERE c.id = $1
       GROUP BY c.id, i.first_name, i.last_name`,
      [params.id]
    );
    if (!courseRes.rows.length) return Response.json({ error: 'Course not found' }, { status: 404 });
    const reviews = await client.query(
      `SELECT * FROM el_review WHERE course_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [params.id]
    );
    return Response.json({ course: courseRes.rows[0], reviews: reviews.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['title','description','instructor_id','category','level','price','status','thumbnail_url','intro_video_url','duration_hours','lessons_count','certificate_enabled'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
  }
  if (!updates.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  values.push(params.id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE el_course SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Course not found' }, { status: 404 });
    return Response.json({ course: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`UPDATE el_course SET status = 'archived' WHERE id = $1`, [params.id]);
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}
