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
      CREATE TABLE IF NOT EXISTS tcm_patient (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE, health_card_number TEXT,
        phone TEXT NOT NULL, email TEXT, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        referral_source TEXT CHECK (referral_source IN ('physician','self','mva','extended_health','friend','other')),
        chief_complaint TEXT NOT NULL, secondary_complaints TEXT[],
        tcm_constitution TEXT CHECK (tcm_constitution IN ('wood','fire','earth','metal','water','mixed')),
        tongue_diagnosis TEXT, pulse_diagnosis TEXT,
        health_conditions TEXT[], medications TEXT[], allergies TEXT[],
        pregnancy_status TEXT DEFAULT 'not_applicable'
          CHECK (pregnancy_status IN ('not_applicable','pregnant','breastfeeding','trying_to_conceive')),
        mva_claim_number TEXT, extended_health_provider TEXT, extended_health_id TEXT,
        coverage_per_visit DECIMAL(10,2), sessions_remaining INTEGER,
        practitioner TEXT, status TEXT DEFAULT 'active' CHECK (status IN ('active','discharged','on_hold')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tcm_treatment (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES tcm_patient(id),
        practitioner TEXT NOT NULL, treatment_date DATE NOT NULL, treatment_time TIME NOT NULL,
        treatment_type TEXT DEFAULT 'acupuncture'
          CHECK (treatment_type IN ('acupuncture','cupping','moxibustion','tui_na','gua_sha','herbal_consult','combination','TCM_assessment')),
        status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
        tongue_findings TEXT, pulse_findings TEXT, tcm_diagnosis TEXT,
        pattern_differentiation TEXT,
        points_needled TEXT[],
        needle_retention_minutes INTEGER DEFAULT 25,
        cupping_areas TEXT[], moxa_points TEXT[],
        herbal_formula TEXT, herbal_modifications TEXT,
        patient_response TEXT CHECK (patient_response IN ('excellent','good','moderate','minimal','worse')),
        post_treatment_advice TEXT,
        fee DECIMAL(10,2), extended_health_claimed DECIMAL(10,2),
        mva_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2), payment_method TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tcm_herbal_formula (
        id SERIAL PRIMARY KEY, formula_name TEXT NOT NULL, formula_name_chinese TEXT,
        category TEXT CHECK (category IN ('classical','modified','custom','patent')),
        indications TEXT[], contraindications TEXT[], ingredients JSONB,
        preparation TEXT DEFAULT 'decoction'
          CHECK (preparation IN ('decoction','granules','pills','tincture','capsules')),
        dosage TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tcm_treatment_plan (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES tcm_patient(id),
        practitioner TEXT, created_date DATE DEFAULT CURRENT_DATE,
        tcm_diagnosis TEXT NOT NULL, pattern TEXT NOT NULL,
        treatment_principle TEXT, acupuncture_protocol TEXT,
        herbal_recommendations TEXT, lifestyle_recommendations TEXT,
        proposed_sessions INTEGER, session_frequency TEXT,
        expected_outcomes TEXT, status TEXT DEFAULT 'active'
          CHECK (status IN ('active','completed','on_hold')),
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
    const today = new Date().toISOString().slice(0, 10);
    const [activeRes, todayRes, mvaRes, herbalRes, revenueRes] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM tcm_patient WHERE status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM tcm_treatment WHERE treatment_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM tcm_patient WHERE mva_claim_number IS NOT NULL AND status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM tcm_herbal_formula`),
      client.query(`SELECT COALESCE(SUM(fee),0) AS total FROM tcm_treatment WHERE DATE_TRUNC('month', treatment_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed'`),
    ]);
    return Response.json({
      patients_active: parseInt(activeRes.rows[0].n, 10),
      treatments_today: parseInt(todayRes.rows[0].n, 10),
      mva_patients: parseInt(mvaRes.rows[0].n, 10),
      herbal_formulas_count: parseInt(herbalRes.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueRes.rows[0].total),
    });
  } finally { client.release(); }
}
