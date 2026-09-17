import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ds_students (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        date_of_birth DATE,
        alberta_id TEXT,
        program TEXT CHECK(program IN ('class5_gdl','class5_full','class1_melt','class6_motorcycle','refresher')) DEFAULT 'class5_gdl',
        lessons_purchased INT DEFAULT 0,
        lessons_completed INT DEFAULT 0,
        theory_test_passed BOOLEAN DEFAULT false,
        road_test_passed BOOLEAN DEFAULT false,
        road_test_attempts INT DEFAULT 0,
        status TEXT DEFAULT 'enrolled',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ds_instructors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        instructor_cert_number TEXT,
        cert_expiry DATE,
        license_classes TEXT[],
        hourly_rate NUMERIC(8,2),
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ds_vehicles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INT,
        license_plate TEXT,
        dual_controls BOOLEAN DEFAULT true,
        vehicle_type TEXT,
        insurance_expiry DATE,
        registration_expiry DATE,
        condition TEXT DEFAULT 'good',
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ds_lessons (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid REFERENCES ds_students(id),
        instructor_id uuid REFERENCES ds_instructors(id),
        vehicle_id uuid REFERENCES ds_vehicles(id),
        lesson_date DATE,
        start_time TIME,
        duration_minutes INT DEFAULT 60,
        lesson_type TEXT,
        pickup_location TEXT,
        status TEXT DEFAULT 'scheduled',
        skills_covered TEXT[],
        instructor_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ds_road_tests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid REFERENCES ds_students(id),
        test_date DATE,
        test_center TEXT,
        test_type TEXT,
        attempt_number INT DEFAULT 1,
        result TEXT DEFAULT 'pending',
        failure_reasons TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureTables();
  } catch {
    return Response.json({ error: 'DB init failed' }, { status: 500 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [students, lessons, tests, instructors] = await Promise.all([
      client.query(`SELECT COUNT(*) AS total_students, COUNT(*) FILTER (WHERE status='enrolled') AS enrolled FROM ds_students`),
      client.query(`SELECT COUNT(*) AS lessons_this_week FROM ds_lessons WHERE lesson_date >= CURRENT_DATE - INTERVAL '7 days' AND lesson_date <= CURRENT_DATE + INTERVAL '7 days'`),
      client.query(`SELECT COUNT(*) AS total_tests, COUNT(*) FILTER (WHERE result='passed') AS tests_passed, COUNT(*) FILTER (WHERE result='pending' AND test_date >= CURRENT_DATE) AS tests_scheduled FROM ds_road_tests`),
      client.query(`SELECT COUNT(*) AS instructors_count FROM ds_instructors WHERE status='active'`),
    ]);

    const totalStudents = parseInt(students.rows[0].total_students, 10);
    const totalTests = parseInt(tests.rows[0].total_tests, 10);
    const testsPassed = parseInt(tests.rows[0].tests_passed, 10);
    const passRate = totalTests > 0 ? Math.round((testsPassed / totalTests) * 100) : 0;

    return Response.json({
      total_students: totalStudents,
      enrolled: parseInt(students.rows[0].enrolled, 10),
      lessons_this_week: parseInt(lessons.rows[0].lessons_this_week, 10),
      tests_scheduled: parseInt(tests.rows[0].tests_scheduled, 10),
      pass_rate_pct: passRate,
      total_tests: totalTests,
      tests_passed: testsPassed,
      instructors_count: parseInt(instructors.rows[0].instructors_count, 10),
    });
  } finally {
    client.release();
  }
}
