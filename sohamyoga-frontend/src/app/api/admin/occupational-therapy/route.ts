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
      CREATE TABLE IF NOT EXISTS ot_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL, health_card_number TEXT,
        phone TEXT, parent_name TEXT, parent_phone TEXT, email TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        referral_source TEXT CHECK (referral_source IN ('physician','school','aish','wca','ahs_home_care','self','other')),
        diagnosis TEXT[], occupational_concerns TEXT[],
        areas_of_focus TEXT[],
        setting TEXT DEFAULT 'clinic' CHECK (setting IN ('clinic','home','school','community','work','hospital')),
        ot TEXT, funding_source TEXT CHECK (funding_source IN ('private_pay','extended_health','aish','wca','ahs','school','other')),
        wca_claim TEXT, aish_file_number TEXT, extended_health_provider TEXT,
        home_assessment_required BOOLEAN DEFAULT false, assistive_devices TEXT[],
        status TEXT DEFAULT 'active' CHECK (status IN ('active','waitlist','discharged','on_hold')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ot_session (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES ot_client(id),
        ot TEXT NOT NULL, session_date DATE NOT NULL,
        start_time TIME NOT NULL, end_time TIME NOT NULL,
        session_setting TEXT CHECK (session_setting IN ('clinic','home','school','community','work','telehealth')),
        session_type TEXT NOT NULL CHECK (session_type IN ('initial_assessment','treatment','home_visit','school_consultation','assistive_device_training','discharge_planning','re_assessment')),
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
        goals_addressed TEXT[], interventions TEXT[],
        client_participation TEXT CHECK (client_participation IN ('full','partial','minimal','refused')),
        session_notes TEXT, caregiver_education TEXT, recommendations TEXT,
        fee DECIMAL(10,2), insurance_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ot_goal (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES ot_client(id),
        ot TEXT, occupational_area TEXT NOT NULL, goal_description TEXT NOT NULL,
        baseline TEXT, target TEXT, measurement_method TEXT,
        target_date DATE, status TEXT DEFAULT 'active'
          CHECK (status IN ('active','achieved','modified','discontinued')),
        achieved_date DATE, progress TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ot_home_modification (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES ot_client(id),
        assessment_date DATE DEFAULT CURRENT_DATE, ot TEXT,
        room TEXT CHECK (room IN ('bathroom','bedroom','kitchen','entrance','living_room','stairs','outdoor','other')),
        modification_type TEXT NOT NULL,
        risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','immediate')),
        recommended_equipment TEXT, estimated_cost DECIMAL(10,2),
        funded_by TEXT, installation_required BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'recommended' CHECK (status IN ('recommended','quoted','approved','installed','declined')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
    const [activeClients, homeVisitsToday, homeAssessmentsPending, wcaCaseload, revenueMtd] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM ot_client WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM ot_session WHERE session_date=$1 AND session_setting='home' AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM ot_client WHERE home_assessment_required=true AND status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM ot_client WHERE funding_source='wca' AND status='active'`),
      client.query(`SELECT COALESCE(SUM(fee),0) AS total FROM ot_session WHERE DATE_TRUNC('month',session_date)=DATE_TRUNC('month',CURRENT_DATE) AND status='completed'`),
    ]);
    const todaySchedule = await client.query(
      `SELECT s.id, s.start_time, s.end_time, s.session_type, s.session_setting, s.status, s.ot,
              c.first_name, c.last_name, c.funding_source, c.wca_claim, c.home_assessment_required
       FROM ot_session s JOIN ot_client c ON c.id=s.client_id
       WHERE s.session_date=$1 ORDER BY s.start_time`, [today]
    );
    const modsPending = await client.query(
      `SELECT m.*, c.first_name, c.last_name FROM ot_home_modification m
       JOIN ot_client c ON c.id=m.client_id WHERE m.status IN ('recommended','quoted')
       ORDER BY CASE m.risk_level WHEN 'immediate' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END LIMIT 10`
    );
    return Response.json({
      active_clients: parseInt(activeClients.rows[0].n),
      home_visits_today: parseInt(homeVisitsToday.rows[0].n),
      home_assessments_pending: parseInt(homeAssessmentsPending.rows[0].n),
      wca_caseload: parseInt(wcaCaseload.rows[0].n),
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
      today_schedule: todaySchedule.rows,
      modifications_pending: modsPending.rows,
    });
  } finally {
    client.release();
  }
}
