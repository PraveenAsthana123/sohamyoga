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
      CREATE TABLE IF NOT EXISTS mh_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE, health_card_number TEXT,
        phone TEXT NOT NULL, email TEXT, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        referral_source TEXT CHECK (referral_source IN ('self','physician','eap','school','court','other')),
        eap_provider TEXT, eap_authorization_code TEXT, eap_sessions_approved INTEGER,
        therapist TEXT, therapy_modality TEXT[],
        presenting_concerns TEXT[] NOT NULL,
        risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low','moderate','high','crisis')),
        safety_plan_in_place BOOLEAN DEFAULT false, emergency_contact_name TEXT, emergency_contact_phone TEXT,
        extended_health_provider TEXT, extended_health_id TEXT, coverage_per_session DECIMAL(10,2),
        aish_funded BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','waitlist','completed','transferred','on_hold')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mh_session (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES mh_client(id),
        therapist TEXT NOT NULL, session_date DATE NOT NULL,
        start_time TIME NOT NULL, end_time TIME NOT NULL,
        session_type TEXT DEFAULT 'individual'
          CHECK (session_type IN ('individual','couples','family','group','intake','crisis','discharge')),
        modality TEXT[],
        status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','completed','cancelled','no_show','late_cancel')),
        presenting_issues TEXT, interventions TEXT[], client_response TEXT, progress TEXT,
        risk_assessment TEXT CHECK (risk_assessment IN ('no_risk','low_risk','moderate_risk','high_risk','crisis')),
        safety_planning_done BOOLEAN DEFAULT false, homework_assigned TEXT,
        fee DECIMAL(10,2), extended_health_claimed DECIMAL(10,2), eap_claimed DECIMAL(10,2),
        aish_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2), payment_method TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mh_treatment_plan (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES mh_client(id),
        therapist TEXT NOT NULL, created_date DATE DEFAULT CURRENT_DATE,
        diagnoses TEXT[],
        treatment_goals TEXT[] NOT NULL,
        modalities_planned TEXT[], session_frequency TEXT,
        proposed_sessions INTEGER, strengths TEXT[], barriers TEXT[],
        crisis_plan TEXT, risk_factors TEXT[], protective_factors TEXT[],
        review_date DATE, status TEXT DEFAULT 'active'
          CHECK (status IN ('active','completed','updated')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mh_crisis_contact (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES mh_client(id),
        contact_name TEXT NOT NULL, relationship TEXT NOT NULL, phone TEXT NOT NULL,
        is_emergency_contact BOOLEAN DEFAULT true, is_aware_of_treatment BOOLEAN DEFAULT false,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
    const today = new Date().toISOString().slice(0, 10);
    const [activeRes, todayRes, crisisRes, eapRes, revenueRes] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM mh_client WHERE status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM mh_session WHERE session_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM mh_client WHERE risk_level IN ('high','crisis') AND status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM mh_client WHERE eap_sessions_approved IS NOT NULL AND eap_sessions_approved > 0 AND status = 'active'`),
      client.query(`SELECT COALESCE(SUM(fee),0) AS total FROM mh_session WHERE DATE_TRUNC('month', session_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed'`),
    ]);
    return Response.json({
      active_clients: parseInt(activeRes.rows[0].n, 10),
      sessions_today: parseInt(todayRes.rows[0].n, 10),
      crisis_clients_count: parseInt(crisisRes.rows[0].n, 10),
      eap_sessions_expiring: parseInt(eapRes.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueRes.rows[0].total),
    });
  } finally { client.release(); }
}
