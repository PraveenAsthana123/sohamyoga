export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureTables(client: Awaited<ReturnType<typeof pool.connect>>) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS hr_job_posting (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, department TEXT,
      employment_type TEXT DEFAULT 'full_time',
      location TEXT DEFAULT 'Calgary, AB', remote_ok BOOLEAN DEFAULT false,
      salary_min NUMERIC(10,2), salary_max NUMERIC(10,2), salary_type TEXT DEFAULT 'annual',
      description TEXT, requirements TEXT[], nice_to_haves TEXT[],
      noc_code TEXT,
      status TEXT DEFAULT 'draft',
      posted_date DATE, closing_date DATE,
      platforms TEXT[],
      applications_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hr_applicant (
      id SERIAL PRIMARY KEY, job_id INT REFERENCES hr_job_posting(id) ON DELETE CASCADE,
      name TEXT NOT NULL, email TEXT, phone TEXT,
      location TEXT, current_title TEXT, years_experience INT,
      education_level TEXT, skills TEXT[],
      resume_url TEXT, cover_letter TEXT,
      source TEXT,
      status TEXT DEFAULT 'new',
      rating INT,
      notes TEXT, applied_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hr_interview (
      id SERIAL PRIMARY KEY, applicant_id INT REFERENCES hr_applicant(id) ON DELETE CASCADE,
      interview_type TEXT DEFAULT 'phone',
      scheduled_at TIMESTAMPTZ, duration_minutes INT DEFAULT 60,
      interviewer TEXT, location TEXT,
      status TEXT DEFAULT 'scheduled',
      feedback TEXT, rating INT,
      recommendation TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hr_employee (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
      department TEXT, job_title TEXT, noc_code TEXT,
      employment_type TEXT, start_date DATE, end_date DATE,
      salary NUMERIC(10,2), pay_frequency TEXT DEFAULT 'bi_weekly',
      sin_last4 TEXT, date_of_birth DATE,
      status TEXT DEFAULT 'active',
      manager TEXT, location TEXT,
      vacation_days_total INT DEFAULT 10, vacation_days_used NUMERIC(5,1) DEFAULT 0,
      emergency_contact TEXT, emergency_phone TEXT,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await ensureTables(client);

    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM hr_job_posting WHERE status='open') AS open_jobs,
        (SELECT COUNT(*) FROM hr_applicant WHERE status NOT IN ('hired','rejected','withdrawn')) AS pipeline_applicants,
        (SELECT COUNT(*) FROM hr_interview WHERE scheduled_at >= DATE_TRUNC('week', NOW()) AND scheduled_at < DATE_TRUNC('week', NOW()) + INTERVAL '7 days') AS interviews_this_week,
        (SELECT COUNT(*) FROM hr_employee WHERE status='active') AS headcount,
        (SELECT COUNT(*) FROM hr_employee WHERE status='terminated' AND end_date >= NOW() - INTERVAL '365 days') AS turnover_ytd,
        (SELECT COUNT(*) FROM hr_employee WHERE status='active') AS total_active
    `);

    return Response.json({ stats: stats.rows[0] });
  } finally {
    client.release();
  }
}
