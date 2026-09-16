export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const { student_email } = body;
  if (!student_email) return Response.json({ error: 'student_email required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Insert enrollment
    await client.query(
      `INSERT INTO academy_enrollments (course_slug, student_email) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [slug, student_email]
    );
    // Update enrolled_count
    await client.query(
      `UPDATE academy_courses SET enrolled_count = (
        SELECT COUNT(*) FROM academy_enrollments WHERE course_slug=$1
      ) WHERE slug=$1`,
      [slug]
    );
    const r = await client.query('SELECT * FROM academy_courses WHERE slug=$1', [slug]);
    return Response.json(r.rows[0] || { ok: true });
  } finally {
    client.release();
  }
}
