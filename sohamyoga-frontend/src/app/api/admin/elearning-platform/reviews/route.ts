import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS el_review (
        id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES el_course(id),
        enrollment_id INTEGER REFERENCES el_enrollment(id),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT, is_featured BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const course_id = searchParams.get('course_id');
  const min_rating = searchParams.get('min_rating');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (course_id) { conditions.push(`r.course_id = $${idx++}`); values.push(course_id); }
  if (min_rating) { conditions.push(`r.rating >= $${idx++}`); values.push(parseInt(min_rating)); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT r.*, c.title AS course_title,
              e.student_name, e.student_email
       FROM el_review r
       LEFT JOIN el_course c ON r.course_id = c.id
       LEFT JOIN el_enrollment e ON r.enrollment_id = e.id
       ${where} ORDER BY r.is_featured DESC, r.created_at DESC LIMIT 100`,
      values
    );
    return Response.json({ reviews: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { course_id, enrollment_id, rating, review_text } = body;
  if (!course_id || !rating) return Response.json({ error: 'course_id and rating required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO el_review (course_id, enrollment_id, rating, review_text)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [course_id, enrollment_id, rating, review_text]
    );
    // Update course avg_rating
    await client.query(
      `UPDATE el_course SET avg_rating = (SELECT AVG(rating) FROM el_review WHERE course_id = $1) WHERE id = $1`,
      [course_id]
    );
    return Response.json({ review: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
