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
      CREATE TABLE IF NOT EXISTS nd_patient (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL, health_card_number TEXT,
        phone TEXT NOT NULL, email TEXT, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        referral_source TEXT, naturopath TEXT,
        chief_complaint TEXT NOT NULL, health_goals TEXT[],
        health_conditions TEXT[], surgeries_hospitalizations TEXT[],
        family_history TEXT[], current_medications TEXT[],
        supplements_vitamins TEXT[], allergies TEXT[], food_sensitivities TEXT[],
        diet_type TEXT CHECK (diet_type IN ('omnivore','vegetarian','vegan','keto','paleo','gluten_free','other')),
        sleep_hours DECIMAL(4,1), exercise_frequency TEXT, stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
        alcohol_use TEXT, smoking_status TEXT, caffeine_daily INTEGER,
        extended_health_provider TEXT, extended_health_id TEXT, coverage_per_visit DECIMAL(10,2),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','discharged','on_hold')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS nd_visit (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES nd_patient(id),
        naturopath TEXT NOT NULL, visit_date DATE NOT NULL, visit_time TIME NOT NULL,
        visit_type TEXT DEFAULT 'follow_up'
          CHECK (visit_type IN ('initial_intake','follow_up','acute_visit','lab_review','supplement_consult','IV_therapy','injection','discharge')),
        status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','completed','cancelled','no_show')),
        subjective TEXT, objective TEXT, assessment TEXT, plan TEXT,
        labs_ordered TEXT[], labs_reviewed TEXT[], lab_findings TEXT,
        therapies_used TEXT[],
        supplements_prescribed JSONB,
        dietary_recommendations TEXT, lifestyle_recommendations TEXT,
        fee DECIMAL(10,2), extended_health_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2),
        payment_method TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS nd_lab_order (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES nd_patient(id),
        visit_id INTEGER REFERENCES nd_visit(id),
        ordered_date DATE DEFAULT CURRENT_DATE, naturopath TEXT,
        lab_type TEXT CHECK (lab_type IN ('blood_panel','hormone','food_sensitivity','heavy_metal','stool','urine','thyroid','adrenal','genetic','DUTCH','GI_Map','other')),
        lab_company TEXT, tests_ordered TEXT[], patient_instructions TEXT,
        results_received BOOLEAN DEFAULT false, results_date DATE,
        results_summary TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS nd_supplement_protocol (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES nd_patient(id),
        naturopath TEXT, created_date DATE DEFAULT CURRENT_DATE,
        health_goals TEXT[], protocol_name TEXT,
        supplements JSONB NOT NULL,
        dietary_protocol TEXT, lifestyle_protocol TEXT, status TEXT DEFAULT 'active',
        next_review_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
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
    const [activeRes, todayRes, labsRes, protocolsRes, revenueRes] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM nd_patient WHERE status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM nd_visit WHERE visit_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM nd_lab_order WHERE results_received = false`),
      client.query(`SELECT COUNT(*) AS n FROM nd_supplement_protocol WHERE status = 'active'`),
      client.query(`SELECT COALESCE(SUM(fee),0) AS total FROM nd_visit WHERE DATE_TRUNC('month', visit_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed'`),
    ]);
    return Response.json({
      active_patients: parseInt(activeRes.rows[0].n, 10),
      visits_today: parseInt(todayRes.rows[0].n, 10),
      labs_pending_results: parseInt(labsRes.rows[0].n, 10),
      supplements_protocols_active: parseInt(protocolsRes.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueRes.rows[0].total),
    });
  } finally { client.release(); }
}
