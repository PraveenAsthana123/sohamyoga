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
      CREATE TABLE IF NOT EXISTS st_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL, health_card_number TEXT,
        phone TEXT, parent_name TEXT, parent_phone TEXT NOT NULL, parent_email TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        referral_source TEXT CHECK (referral_source IN ('physician','school','self','aish','cbs','other')),
        referring_professional TEXT,
        primary_diagnosis TEXT, communication_goals TEXT[],
        areas_of_focus TEXT[],
        session_type TEXT DEFAULT 'individual' CHECK (session_type IN ('individual','group','parent_coaching','school_consultation','telepractice')),
        frequency TEXT DEFAULT 'weekly',
        slp TEXT, alberta_health_covered BOOLEAN DEFAULT false,
        aish_funded BOOLEAN DEFAULT false, cbs_funded BOOLEAN DEFAULT false,
        extended_health_provider TEXT, extended_health_id TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','waitlist','discharged','on_hold')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS st_session (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES st_client(id),
        slp TEXT NOT NULL, session_date DATE NOT NULL,
        start_time TIME NOT NULL, end_time TIME NOT NULL,
        session_type TEXT NOT NULL CHECK (session_type IN ('individual','group','parent_coaching','consultation','assessment','discharge')),
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','client_absent','clinician_absent','cancelled')),
        goals_addressed TEXT[], activities_used TEXT[],
        client_performance TEXT CHECK (client_performance IN ('excellent','good','moderate','minimal','refused')),
        parent_communication_provided BOOLEAN DEFAULT false,
        session_notes TEXT, homework_assigned TEXT,
        fee DECIMAL(10,2), funding_source TEXT CHECK (funding_source IN ('private_pay','extended_health','aish','cbs','school_division','other')),
        insurance_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS st_goal (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES st_client(id),
        slp TEXT, goal_area TEXT NOT NULL, goal_description TEXT NOT NULL,
        baseline TEXT, target_accuracy TEXT DEFAULT '80%',
        target_date DATE, status TEXT DEFAULT 'active'
          CHECK (status IN ('active','mastered','modified','discontinued')),
        progress_notes TEXT, mastered_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS st_assessment (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES st_client(id),
        slp TEXT, assessment_date DATE DEFAULT CURRENT_DATE,
        assessment_tools TEXT[],
        areas_assessed TEXT[], standardized_scores JSONB,
        clinical_impressions TEXT, recommendations TEXT, report_completed BOOLEAN DEFAULT false,
        report_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [activeClients, waitlistCount, sessionsToday, goalsMastered, revenueMtd] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM st_client WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM st_client WHERE status='waitlist'`),
      client.query(`SELECT COUNT(*) AS n FROM st_session WHERE session_date=$1 AND status NOT IN ('cancelled','client_absent')`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM st_goal WHERE status='mastered' AND DATE_TRUNC('month',mastered_date)=DATE_TRUNC('month',CURRENT_DATE)`),
      client.query(`SELECT COALESCE(SUM(fee),0) AS total FROM st_session WHERE DATE_TRUNC('month',session_date)=DATE_TRUNC('month',CURRENT_DATE) AND status='completed'`),
    ]);
    const todaySessions = await client.query(
      `SELECT s.id, s.start_time, s.end_time, s.session_type, s.status, s.slp,
              c.first_name, c.last_name, c.primary_diagnosis, c.areas_of_focus
       FROM st_session s JOIN st_client c ON c.id=s.client_id
       WHERE s.session_date=$1 ORDER BY s.start_time`, [today]
    );
    return Response.json({
      active_clients: parseInt(activeClients.rows[0].n),
      waitlist_count: parseInt(waitlistCount.rows[0].n),
      sessions_today: parseInt(sessionsToday.rows[0].n),
      goals_mastered_mtd: parseInt(goalsMastered.rows[0].n),
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
      today_sessions: todaySessions.rows,
    });
  } finally {
    client.release();
  }
}
