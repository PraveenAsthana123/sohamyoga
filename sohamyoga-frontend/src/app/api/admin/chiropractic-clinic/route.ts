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
      CREATE TABLE IF NOT EXISTS chiro_patient (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE, health_card_number TEXT,
        phone TEXT NOT NULL, email TEXT, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        referral_source TEXT CHECK (referral_source IN ('physician','self','mva','wca','extended_health','other')),
        primary_complaint TEXT NOT NULL, secondary_complaints TEXT[],
        pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
        duration_of_complaint TEXT, onset_type TEXT CHECK (onset_type IN ('sudden','gradual','mva','work_injury','sport','unknown')),
        previous_chiro_care BOOLEAN DEFAULT false,
        contraindications TEXT[], medications TEXT[], health_conditions TEXT[],
        mva_claim_number TEXT, wca_claim_number TEXT,
        extended_health_provider TEXT, extended_health_id TEXT, coverage_per_visit DECIMAL(10,2),
        chiropractor TEXT, status TEXT DEFAULT 'active' CHECK (status IN ('active','discharged','on_hold')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chiro_visit (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES chiro_patient(id),
        chiropractor TEXT NOT NULL, visit_date DATE NOT NULL, visit_time TIME NOT NULL,
        visit_type TEXT DEFAULT 'treatment' CHECK (visit_type IN ('initial_assessment','treatment','re_assessment','discharge','consultation')),
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
        subjective TEXT, pain_level_today INTEGER CHECK (pain_level_today BETWEEN 0 AND 10),
        objective TEXT, range_of_motion TEXT,
        assessment TEXT, progress TEXT CHECK (progress IN ('improved','same','worse','resolved')),
        plan TEXT, adjustments_performed TEXT[], modalities_used TEXT[],
        home_exercises_given TEXT,
        fee DECIMAL(10,2), extended_health_claimed DECIMAL(10,2),
        mva_claimed DECIMAL(10,2), wca_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2),
        payment_method TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chiro_treatment_plan (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES chiro_patient(id),
        chiropractor TEXT NOT NULL, created_date DATE DEFAULT CURRENT_DATE,
        diagnosis TEXT NOT NULL, treatment_frequency TEXT,
        proposed_visits INTEGER, duration_weeks INTEGER,
        techniques TEXT[], goals TEXT,
        mva_pre_authorized BOOLEAN DEFAULT false, wca_pre_authorized BOOLEAN DEFAULT false,
        auth_visits INTEGER, status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','on_hold')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chiro_xray (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES chiro_patient(id),
        chiropractor TEXT, xray_date DATE DEFAULT CURRENT_DATE,
        views_taken TEXT[], findings TEXT, subluxations TEXT[],
        recommendations TEXT, image_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
    const [patientsActive, visitsToday, mvawcaPatients, coveragePending, revenueMtd] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM chiro_patient WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM chiro_visit WHERE visit_date=$1 AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM chiro_patient WHERE (mva_claim_number IS NOT NULL OR wca_claim_number IS NOT NULL) AND status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM chiro_visit WHERE status='completed' AND (extended_health_claimed IS NOT NULL OR mva_claimed IS NOT NULL OR wca_claimed IS NOT NULL) AND patient_paid IS NULL`),
      client.query(`SELECT COALESCE(SUM(fee),0) AS total FROM chiro_visit WHERE DATE_TRUNC('month',visit_date)=DATE_TRUNC('month',CURRENT_DATE) AND status='completed'`),
    ]);
    const todaySchedule = await client.query(
      `SELECT v.id, v.visit_time, v.visit_type, v.status, v.chiropractor,
              p.first_name, p.last_name, p.primary_complaint, p.mva_claim_number, p.wca_claim_number, p.extended_health_provider
       FROM chiro_visit v JOIN chiro_patient p ON p.id=v.patient_id
       WHERE v.visit_date=$1 ORDER BY v.visit_time`, [today]
    );
    return Response.json({
      patients_active: parseInt(patientsActive.rows[0].n),
      visits_today: parseInt(visitsToday.rows[0].n),
      mva_wca_patients: parseInt(mvawcaPatients.rows[0].n),
      coverage_claims_pending: parseInt(coveragePending.rows[0].n),
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
      today_schedule: todaySchedule.rows,
    });
  } finally {
    client.release();
  }
}
