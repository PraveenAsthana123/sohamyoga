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
      CREATE TABLE IF NOT EXISTS dance_students (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        parent_name TEXT,
        parent_email TEXT,
        parent_phone TEXT,
        emergency_contact TEXT,
        dance_styles TEXT[] DEFAULT '{}',
        current_level TEXT,
        exam_track BOOLEAN DEFAULT FALSE,
        competition_team BOOLEAN DEFAULT FALSE,
        medical_notes TEXT,
        photo_consent BOOLEAN DEFAULT FALSE,
        liability_waiver_signed BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','waitlist')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dance_instructors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        dance_styles TEXT[] DEFAULT '{}',
        certifications TEXT[] DEFAULT '{}',
        years_experience INTEGER,
        hourly_rate NUMERIC(10,2),
        employment_type TEXT DEFAULT 'employee' CHECK (employment_type IN ('employee','contractor')),
        vulnerable_sector_check_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dance_classes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        dance_style TEXT CHECK (dance_style IN ('ballet','jazz','tap','contemporary','hip_hop','lyrical','acrobatics','ballroom','competitive')),
        level TEXT CHECK (level IN ('preschool','primary','grade1','grade2','grade3','grade4','grade5','grade6','grade7','grade8','advanced','adult','beginner')),
        instructor_id INTEGER REFERENCES dance_instructors(id),
        day_of_week TEXT CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
        start_time TIME,
        end_time TIME,
        studio_room TEXT,
        max_capacity INTEGER DEFAULT 20,
        current_enrollment INTEGER DEFAULT 0,
        monthly_fee NUMERIC(10,2),
        term TEXT CHECK (term IN ('fall','winter','spring','summer')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dance_enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES dance_students(id),
        class_id INTEGER REFERENCES dance_classes(id),
        enrollment_date DATE DEFAULT CURRENT_DATE,
        term TEXT,
        monthly_fee NUMERIC(10,2),
        payment_method TEXT,
        auto_renew BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','dropped','completed','waitlist')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dance_exams (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES dance_students(id),
        exam_type TEXT CHECK (exam_type IN ('RAD','Cecchetti','ADAPT','festival_solo','festival_group')),
        exam_level TEXT,
        exam_date DATE,
        examiner_name TEXT,
        result TEXT DEFAULT 'pending' CHECK (result IN ('distinction','merit','pass','fail','pending')),
        mark_pct NUMERIC(5,2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dance_recitals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        recital_date DATE,
        venue TEXT,
        ticket_price NUMERIC(10,2),
        costume_fee NUMERIC(10,2),
        total_participants INTEGER DEFAULT 0,
        revenue_tickets NUMERIC(10,2) DEFAULT 0,
        revenue_costumes NUMERIC(10,2) DEFAULT 0,
        status TEXT DEFAULT 'planning' CHECK (status IN ('planning','registering','rehearsal','completed')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [studentsRes, classesRes, enrollRes, recitalRes, revenueRes, costumesRes] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM dance_students WHERE status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM dance_classes WHERE is_active = TRUE`),
      client.query(`SELECT COUNT(*) AS n FROM dance_enrollments WHERE DATE_TRUNC('month', enrollment_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM dance_recitals WHERE status IN ('planning','registering','rehearsal')`),
      client.query(`SELECT COALESCE(SUM(monthly_fee),0) AS total FROM dance_enrollments WHERE DATE_TRUNC('month', enrollment_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'active'`),
      client.query(`SELECT COALESCE(SUM(revenue_costumes),0) AS total FROM dance_recitals WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', NOW())`),
    ]);
    return Response.json({
      total_students: parseInt(studentsRes.rows[0].n, 10),
      active_classes: parseInt(classesRes.rows[0].n, 10),
      enrollment_this_month: parseInt(enrollRes.rows[0].n, 10),
      recital_registrations: parseInt(recitalRes.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueRes.rows[0].total),
      costume_deposits_collected: parseFloat(costumesRes.rows[0].total),
    });
  } finally { client.release(); }
}
