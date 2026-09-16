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
    const instructorRes = await client.query(`SELECT * FROM el_instructor WHERE id = $1`, [params.id]);
    if (!instructorRes.rows.length) return Response.json({ error: 'Instructor not found' }, { status: 404 });
    const courses = await client.query(
      `SELECT c.*,
              COALESCE(SUM(e.payment_amount), 0) AS total_revenue,
              COALESCE(SUM(e.payment_amount * i.revenue_share_pct / 100), 0) AS instructor_earnings
       FROM el_course c
       LEFT JOIN el_enrollment e ON e.course_id = c.id AND e.refunded = false
       LEFT JOIN el_instructor i ON c.instructor_id = i.id
       WHERE c.instructor_id = $1
       GROUP BY c.id, i.revenue_share_pct
       ORDER BY c.created_at DESC`,
      [params.id]
    );
    return Response.json({ instructor: instructorRes.rows[0], courses: courses.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['first_name','last_name','email','bio','expertise','revenue_share_pct','status'];
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
      `UPDATE el_instructor SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Instructor not found' }, { status: 404 });
    return Response.json({ instructor: result.rows[0] });
  } finally {
    client.release();
  }
}
