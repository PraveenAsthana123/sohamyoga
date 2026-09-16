import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pt_patient (
      id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      date_of_birth DATE, health_card_number TEXT,
      phone TEXT NOT NULL, email TEXT, address TEXT,
      city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
      referral_source TEXT CHECK (referral_source IN ('physician','self','wca','mvac','insurance','employer','other')),
      referring_physician TEXT, physician_fax TEXT,
      injury_type TEXT, primary_diagnosis TEXT, secondary_diagnoses TEXT[],
      date_of_injury DATE, wca_claim_number TEXT, wca_approved BOOLEAN,
      mvac_claim_number TEXT, group_benefits_provider TEXT, group_benefits_id TEXT,
      alberta_health_covered BOOLEAN DEFAULT false,
      treatment_goals TEXT, precautions TEXT[], contraindications TEXT[],
      status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','discharged','waitlist')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pt_appointment (
      id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES pt_patient(id),
      physio TEXT NOT NULL, appointment_date DATE NOT NULL,
      start_time TIME NOT NULL, end_time TIME NOT NULL,
      treatment_type TEXT NOT NULL CHECK (treatment_type IN ('initial_assessment','follow_up','manual_therapy','exercise_therapy','acupuncture','ultrasound','TENS','IFC','taping','work_conditioning','discharge_assessment','home_program_review')),
      status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
      subjective TEXT, objective TEXT, assessment TEXT, plan TEXT,
      exercises_prescribed TEXT[], home_program_updated BOOLEAN DEFAULT false,
      wca_visit BOOLEAN DEFAULT false, mvac_visit BOOLEAN DEFAULT false,
      fee DECIMAL(10,2), insurance_claimed DECIMAL(10,2),
      patient_paid DECIMAL(10,2), payment_method TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pt_treatment_plan (
      id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES pt_patient(id),
      physio TEXT NOT NULL, created_date DATE DEFAULT CURRENT_DATE,
      diagnosis TEXT NOT NULL, treatment_goals TEXT NOT NULL,
      proposed_visits INTEGER, frequency TEXT,
      duration_weeks INTEGER, techniques_planned TEXT[],
      expected_outcomes TEXT, discharge_criteria TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','on_hold')),
      wca_pre_authorized BOOLEAN DEFAULT false, wca_auth_visits INTEGER,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pt_outcome_measure (
      id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES pt_patient(id),
      assessment_date DATE NOT NULL, physio TEXT, measure_type TEXT NOT NULL
        CHECK (measure_type IN ('DASH','NDI','LEFS','Oswestry','PSFS','NPRS','VAS','ROM','grip_strength','6MWT','other')),
      score DECIMAL(8,2), max_score DECIMAL(8,2), interpretation TEXT,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const today = new Date().toISOString().slice(0, 10);
    const [activePatients, apptToday, wcaPatients, dischargeDue, revenueMtd] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM pt_patient WHERE status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM pt_appointment WHERE appointment_date = $1 AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM pt_patient WHERE wca_claim_number IS NOT NULL AND status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM pt_treatment_plan WHERE status = 'active' AND (CURRENT_DATE - created_date) >= (duration_weeks * 7 - 7)`),
      client.query(`SELECT COALESCE(SUM(patient_paid),0) + COALESCE(SUM(insurance_claimed),0) AS total FROM pt_appointment WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', NOW()) AND status = 'completed'`),
    ]);
    return Response.json({
      patients_active: parseInt(activePatients.rows[0].n, 10),
      appointments_today: parseInt(apptToday.rows[0].n, 10),
      wca_patients: parseInt(wcaPatients.rows[0].n, 10),
      discharge_due_this_week: parseInt(dischargeDue.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
    });
  } finally { client.release(); }
}
