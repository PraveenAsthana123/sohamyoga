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
      CREATE TABLE IF NOT EXISTS el_enrollment (
        id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES el_course(id),
        student_email TEXT NOT NULL, student_name TEXT NOT NULL,
        enrolled_at TIMESTAMPTZ DEFAULT NOW(), progress_pct INTEGER DEFAULT 0,
        completed_at TIMESTAMPTZ, certificate_issued BOOLEAN DEFAULT false,
        payment_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT CHECK (payment_method IN ('stripe','paypal','etransfer','free','coupon')),
        refunded BOOLEAN DEFAULT false, refunded_at TIMESTAMPTZ
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
  const completed = searchParams.get('completed');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (course_id) { conditions.push(`e.course_id = $${idx++}`); values.push(course_id); }
  if (completed === 'true') { conditions.push(`e.completed_at IS NOT NULL`); }
  if (completed === 'false') { conditions.push(`e.completed_at IS NULL`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT e.*, c.title AS course_title
       FROM el_enrollment e
       LEFT JOIN el_course c ON e.course_id = c.id
       ${where} ORDER BY e.enrolled_at DESC LIMIT 200`,
      values
    );
    return Response.json({ enrollments: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { course_id, student_email, student_name, payment_amount = 0, payment_method } = body;
  if (!course_id || !student_email || !student_name) {
    return Response.json({ error: 'course_id, student_email, student_name required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO el_enrollment (course_id, student_email, student_name, payment_amount, payment_method)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [course_id, student_email, student_name, payment_amount, payment_method]
    );
    await client.query(`UPDATE el_course SET enrolled_count = enrolled_count + 1 WHERE id = $1`, [course_id]);
    return Response.json({ enrollment: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
