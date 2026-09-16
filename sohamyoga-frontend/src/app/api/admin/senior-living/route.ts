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
      CREATE TABLE IF NOT EXISTS sl_residents (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        admission_date DATE DEFAULT CURRENT_DATE,
        room_number TEXT,
        unit TEXT DEFAULT 'assisted' CHECK (unit IN ('independent','assisted','memory_care','long_term')),
        care_level INT DEFAULT 3 CHECK (care_level BETWEEN 1 AND 5),
        primary_diagnosis TEXT,
        secondary_diagnoses TEXT[],
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        emergency_contact_relation TEXT,
        physician_name TEXT,
        dnr_status BOOLEAN DEFAULT false,
        aish_recipient BOOLEAN DEFAULT false,
        funding_type TEXT DEFAULT 'private' CHECK (funding_type IN ('private','ahs','veterans','aish')),
        daily_rate NUMERIC(8,2),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','hospital','leave','discharged')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sl_care_assessments (
        id SERIAL PRIMARY KEY,
        resident_id INT REFERENCES sl_residents(id) ON DELETE CASCADE,
        assessment_type TEXT CHECK (assessment_type IN ('RAI-MDS','fall_risk','skin','nutrition','cognitive','pain')),
        assessed_by TEXT,
        assessment_date DATE DEFAULT CURRENT_DATE,
        score NUMERIC(6,2),
        risk_level TEXT CHECK (risk_level IN ('low','medium','high')),
        recommendations TEXT[],
        next_assessment_due DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sl_incidents (
        id SERIAL PRIMARY KEY,
        resident_id INT REFERENCES sl_residents(id) ON DELETE CASCADE,
        incident_type TEXT CHECK (incident_type IN ('fall','medication_error','behavioral','elopement','injury','other')),
        severity TEXT CHECK (severity IN ('minor','moderate','serious','critical')),
        occurred_at TIMESTAMPTZ DEFAULT NOW(),
        location TEXT,
        witnessed_by TEXT,
        description TEXT,
        immediate_action TEXT,
        physician_notified BOOLEAN DEFAULT false,
        family_notified BOOLEAN DEFAULT false,
        ahs_reportable BOOLEAN DEFAULT false,
        outcome TEXT,
        staff_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sl_medications (
        id SERIAL PRIMARY KEY,
        resident_id INT REFERENCES sl_residents(id) ON DELETE CASCADE,
        drug_name TEXT NOT NULL,
        dosage TEXT,
        route TEXT CHECK (route IN ('oral','topical','inhaled','injection','sublingual')),
        frequency TEXT,
        times_of_day TEXT[],
        prescribing_physician TEXT,
        start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE,
        controlled_substance BOOLEAN DEFAULT false,
        pharmacy_name TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sl_medication_admin (
        id SERIAL PRIMARY KEY,
        medication_id INT REFERENCES sl_medications(id) ON DELETE CASCADE,
        resident_id INT REFERENCES sl_residents(id) ON DELETE CASCADE,
        administered_by TEXT NOT NULL,
        administered_at TIMESTAMPTZ DEFAULT NOW(),
        dose_given TEXT,
        refused BOOLEAN DEFAULT false,
        refused_reason TEXT,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS sl_staff (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT CHECK (role IN ('RN','LPN','HCA','dietary','housekeeping','admin','activity')),
        certification_number TEXT,
        certification_expiry DATE,
        shift TEXT DEFAULT 'day' CHECK (shift IN ('day','evening','night')),
        status TEXT DEFAULT 'off_duty' CHECK (status IN ('on_duty','off_duty','on_leave')),
        vulnerable_sector_check_date DATE,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sl_family_messages (
        id SERIAL PRIMARY KEY,
        resident_id INT REFERENCES sl_residents(id) ON DELETE CASCADE,
        sender_role TEXT CHECK (sender_role IN ('staff','family','admin')),
        sender_name TEXT,
        message_text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM sl_residents`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO sl_residents (first_name, last_name, date_of_birth, admission_date, room_number, unit, care_level, primary_diagnosis, secondary_diagnoses, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, physician_name, dnr_status, aish_recipient, funding_type, daily_rate, status)
        VALUES
          ('Margaret','Thompson','1932-04-12','2024-03-01','101A','long_term',4,'Moderate Dementia',ARRAY['Hypertension','Type 2 Diabetes'],'Robert Thompson','403-555-0101','Son','Dr. S. Patel',true,false,'ahs',285,'active'),
          ('Harold','Kowalski','1938-11-08','2024-06-15','203B','assisted',2,'Parkinson''s Disease',ARRAY['Osteoporosis'],'Maria Kowalski','403-555-0202','Daughter','Dr. A. Nguyen',false,false,'veterans',320,'active'),
          ('Dorothy','Redcloud','1941-07-22','2025-01-10','305C','memory_care',5,'Advanced Alzheimer''s',ARRAY['Atrial Fibrillation','CHF'],'James Redcloud','780-555-0303','Son','Dr. M. Singh',true,false,'ahs',395,'active'),
          ('William','Fraser','1945-02-18','2025-04-01','108A','independent',1,'Hip Replacement Recovery',ARRAY[],'Susan Fraser','403-555-0404','Wife','Dr. J. Larsen',false,true,'aish',195,'active'),
          ('Edith','Laboucan','1936-09-30','2023-11-20','212D','long_term',3,'COPD',ARRAY['Hypertension','Anxiety'],'Thomas Laboucan','780-555-0505','Nephew','Dr. R. Chen',false,true,'aish',265,'active')
      `);
      await client.query(`
        INSERT INTO sl_staff (name, role, certification_number, certification_expiry, shift, status, vulnerable_sector_check_date, is_active)
        VALUES
          ('Jennifer Okafor','RN','AB-RN-88421','2026-06-30','day','on_duty','2024-01-15',true),
          ('Carlos Diaz','LPN','AB-LPN-55190','2025-12-31','evening','on_duty','2023-09-01',true),
          ('Priya Sharma','HCA','AB-HCA-72331',NULL,'night','off_duty','2024-03-20',true),
          ('Linda Yellowbird','RN','AB-RN-91005','2027-03-15','day','on_duty','2024-07-10',true),
          ('Mike Tremblay','HCA','AB-HCA-60114',NULL,'evening','off_duty','2023-11-05',true)
      `);
    }
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
    const [resCount, staffCount, incidents, assessments, medications] = await Promise.all([
      client.query(`SELECT COUNT(*) AS total, unit, COUNT(*) FILTER (WHERE status='active') AS active FROM sl_residents GROUP BY unit`),
      client.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='on_duty') AS on_duty FROM sl_staff WHERE is_active = true`),
      client.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE severity IN ('serious','critical')) AS serious FROM sl_incidents WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)`),
      client.query(`SELECT COUNT(*) AS total FROM sl_care_assessments WHERE next_assessment_due <= $1`, [today]),
      client.query(`SELECT COUNT(*) AS total FROM sl_medications m WHERE is_active = true AND EXISTS (SELECT 1 FROM sl_medication_admin ma WHERE ma.medication_id = m.id AND DATE(ma.administered_at) = $1)`, [today]),
    ]);
    const totalResidents = (resCount.rows as {total: string}[]).reduce((s, r) => s + parseInt(r.total, 10), 0);
    const activeResidents = (resCount.rows as {active: string}[]).reduce((s, r) => s + parseInt(r.active, 10), 0);
    const unitCounts: Record<string, number> = {};
    const UNIT_CAP: Record<string, number> = { independent: 20, assisted: 40, memory_care: 20, long_term: 30 };
    for (const r of resCount.rows as {unit: string; active: string}[]) { unitCounts[r.unit] = parseInt(r.active, 10); }
    const totalCap = Object.values(UNIT_CAP).reduce((a, b) => a + b, 0);
    const avgOccupancy = Math.round((activeResidents / totalCap) * 100);
    return Response.json({
      total_residents: totalResidents,
      active_residents: activeResidents,
      avg_occupancy_pct: avgOccupancy,
      unit_counts: unitCounts,
      staff_on_shift: parseInt((staffCount.rows[0] as {on_duty: string}).on_duty ?? '0', 10),
      total_staff: parseInt((staffCount.rows[0] as {total: string}).total ?? '0', 10),
      incident_reports_mtd: parseInt((incidents.rows[0] as {total: string}).total ?? '0', 10),
      serious_incidents_mtd: parseInt((incidents.rows[0] as {serious: string}).serious ?? '0', 10),
      medication_rounds_today: parseInt((medications.rows[0] as {total: string}).total ?? '0', 10),
      pending_assessments: parseInt((assessments.rows[0] as {total: string}).total ?? '0', 10),
    });
  } finally { client.release(); }
}
