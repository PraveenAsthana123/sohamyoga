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
      CREATE TABLE IF NOT EXISTS tc_student (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT, parent_name TEXT, parent_phone TEXT, parent_email TEXT,
        grade_level TEXT NOT NULL, school TEXT, school_board TEXT DEFAULT 'CBE'
          CHECK (school_board IN ('CBE','CCSD','CSSD','FHSD','Rocky_View','Other')),
        subjects_needed TEXT[] NOT NULL,
        learning_goals TEXT, learning_challenges TEXT, iep_student BOOLEAN DEFAULT false,
        preferred_tutor TEXT, session_type TEXT DEFAULT 'in_person'
          CHECK (session_type IN ('in_person','online','hybrid')),
        session_frequency TEXT DEFAULT 'weekly'
          CHECK (session_frequency IN ('twice_weekly','weekly','bi_weekly','as_needed')),
        hourly_rate DECIMAL(10,2), monthly_package_rate DECIMAL(10,2),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','completed')),
        enrolled_date DATE DEFAULT CURRENT_DATE, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tc_session (
        id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES tc_student(id),
        tutor TEXT NOT NULL, session_date DATE NOT NULL,
        start_time TIME NOT NULL, end_time TIME NOT NULL,
        subject TEXT NOT NULL, topics_covered TEXT[],
        homework_assigned TEXT, student_progress TEXT
          CHECK (student_progress IN ('excellent','good','steady','needs_support','struggling')),
        status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','completed','student_absent','tutor_absent','cancelled')),
        session_notes TEXT, parent_communication_sent BOOLEAN DEFAULT false,
        amount_billed DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tc_assessment (
        id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES tc_student(id),
        assessment_date DATE DEFAULT CURRENT_DATE, assessed_by TEXT,
        subject TEXT NOT NULL, grade_level TEXT,
        strengths TEXT[], weaknesses TEXT[], recommended_focus TEXT,
        current_grade_estimate TEXT, target_grade TEXT,
        recommended_sessions_per_week INTEGER DEFAULT 1,
        assessment_notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tc_invoice (
        id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES tc_student(id),
        invoice_date DATE DEFAULT CURRENT_DATE, period_start DATE, period_end DATE,
        sessions_count INTEGER, amount DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','partial','overdue')),
        paid_date DATE, payment_method TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM tc_student`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO tc_student (first_name, last_name, email, phone, parent_name, parent_phone, parent_email, grade_level, school, school_board, subjects_needed, learning_goals, preferred_tutor, session_frequency, hourly_rate, status)
        VALUES
          ('Emily','Chen','emily.c@email.ca','403-555-0101','David Chen','403-555-0100','david.chen@email.ca','Grade 10','Western Canada High','CBE',ARRAY['Math','Physics'],'Improve grade from 68% to 80%','Sarah K.',  'weekly',55.00,'active'),
          ('Marcus','Williams','marcus.w@email.ca','403-555-0202','Angela Williams','403-555-0201','angela.w@email.ca','Grade 7','Colonel Walker School','CBE',ARRAY['English','Social Studies'],'Catch up to grade level','James R.','twice_weekly',50.00,'active'),
          ('Sofia','Patel','sofia.p@email.ca','403-555-0303','Raj Patel','403-555-0302','raj.patel@email.ca','Grade 12','Bishop Carroll High','CSSD',ARRAY['Calculus','Chemistry'],'Prepare for university','Sarah K.','weekly',60.00,'active'),
          ('Liam','Tremblay','liam.t@email.ca','403-555-0404','Marie Tremblay','403-555-0403','marie.t@email.ca','Grade 4','Ramsay School','CBE',ARRAY['Reading','Writing'],'Build reading confidence','James R.','twice_weekly',45.00,'active')
      `);
      await client.query(`
        INSERT INTO tc_session (student_id, tutor, session_date, start_time, end_time, subject, topics_covered, student_progress, status, amount_billed)
        VALUES
          (1,'Sarah K.',CURRENT_DATE,'16:00','17:00','Math',ARRAY['Quadratic equations','Factoring'],'good','completed',55.00),
          (2,'James R.',CURRENT_DATE,'15:00','16:00','English',ARRAY['Paragraph structure','Topic sentences'],'steady','completed',50.00),
          (3,'Sarah K.',CURRENT_DATE + 1,'16:00','17:00','Calculus',ARRAY['Derivatives','Chain rule'],'excellent','scheduled',60.00),
          (4,'James R.',CURRENT_DATE + 1,'14:00','15:00','Reading',ARRAY['Phonics','Sight words'],'needs_support','scheduled',45.00)
      `);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const [active, sessToday, sessWeek, revenue, unpaid] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM tc_student WHERE status='active'`),
        client.query(`SELECT COUNT(*) AS n FROM tc_session WHERE session_date=$1 AND status NOT IN ('cancelled')`, [today]),
        client.query(`SELECT COUNT(*) AS n FROM tc_session WHERE session_date BETWEEN $1 AND $2 AND status NOT IN ('cancelled')`, [today, weekEnd]),
        client.query(`SELECT COALESCE(SUM(amount_billed),0) AS rev FROM tc_session WHERE DATE_TRUNC('month',session_date::timestamptz)=DATE_TRUNC('month',NOW()) AND status='completed'`),
        client.query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM tc_invoice WHERE status IN ('unpaid','overdue')`),
      ]);
      return Response.json({
        active_students: parseInt(active.rows[0].n, 10),
        sessions_today: parseInt(sessToday.rows[0].n, 10),
        sessions_this_week: parseInt(sessWeek.rows[0].n, 10),
        revenue_mtd: parseFloat(revenue.rows[0].rev),
        unpaid_invoices: parseInt(unpaid.rows[0].n, 10),
        unpaid_total: parseFloat(unpaid.rows[0].total),
      });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
