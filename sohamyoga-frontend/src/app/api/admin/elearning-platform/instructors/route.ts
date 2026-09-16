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
      CREATE TABLE IF NOT EXISTS el_instructor (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL, bio TEXT, expertise TEXT[],
        revenue_share_pct DECIMAL(5,2) DEFAULT 70.00,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
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
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT i.*,
             COUNT(DISTINCT c.id) AS course_count,
             COALESCE(SUM(e.payment_amount * i.revenue_share_pct / 100), 0) AS estimated_earnings
      FROM el_instructor i
      LEFT JOIN el_course c ON c.instructor_id = i.id AND c.status = 'published'
      LEFT JOIN el_enrollment e ON e.course_id = c.id AND e.refunded = false
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);
    return Response.json({ instructors: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { first_name, last_name, email, bio, expertise = [], revenue_share_pct = 70.00 } = body;
  if (!first_name || !last_name || !email) {
    return Response.json({ error: 'first_name, last_name, email required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO el_instructor (first_name, last_name, email, bio, expertise, revenue_share_pct)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [first_name, last_name, email, bio, expertise, revenue_share_pct]
    );
    return Response.json({ instructor: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
