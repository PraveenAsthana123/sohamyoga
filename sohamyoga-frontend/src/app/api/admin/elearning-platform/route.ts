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
    await client.query(`
      CREATE TABLE IF NOT EXISTS el_course (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE,
        description TEXT, instructor_id INTEGER REFERENCES el_instructor(id),
        category TEXT NOT NULL CHECK (category IN ('business','technology','marketing','design','health','finance','language','trades','personal_development','other')),
        level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced','all_levels')),
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')),
        thumbnail_url TEXT, intro_video_url TEXT,
        duration_hours DECIMAL(6,2), lessons_count INTEGER DEFAULT 0,
        enrolled_count INTEGER DEFAULT 0, avg_rating DECIMAL(3,2),
        certificate_enabled BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
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
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [courses, enrollments, revenue, rating, completions] = await Promise.all([
      client.query(`SELECT COUNT(*) AS total_courses FROM el_course WHERE status != 'archived'`),
      client.query(`SELECT COUNT(*) AS active_enrollments FROM el_enrollment WHERE completed_at IS NULL AND refunded = false`),
      client.query(`
        SELECT COALESCE(SUM(payment_amount),0) AS revenue_mtd
        FROM el_enrollment
        WHERE date_trunc('month', enrolled_at) = date_trunc('month', NOW())
          AND refunded = false
      `),
      client.query(`SELECT COALESCE(AVG(rating),0) AS avg_platform_rating FROM el_review`),
      client.query(`
        SELECT COUNT(*) AS completions_mtd
        FROM el_enrollment
        WHERE date_trunc('month', completed_at) = date_trunc('month', NOW())
      `),
    ]);
    return Response.json({
      total_courses: parseInt(courses.rows[0].total_courses),
      active_enrollments: parseInt(enrollments.rows[0].active_enrollments),
      revenue_mtd: parseFloat(revenue.rows[0].revenue_mtd),
      avg_platform_rating: parseFloat(parseFloat(rating.rows[0].avg_platform_rating).toFixed(2)),
      completions_mtd: parseInt(completions.rows[0].completions_mtd),
    });
  } finally {
    client.release();
  }
}
