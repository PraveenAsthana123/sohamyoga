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
      CREATE TABLE IF NOT EXISTS clinic_patient (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
        date_of_birth DATE, health_card_number TEXT,
        alberta_health_number TEXT,
        address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        gender TEXT, preferred_language TEXT DEFAULT 'English',
        emergency_contact TEXT, emergency_phone TEXT,
        allergies TEXT[], medical_alerts TEXT[],
        primary_insurer TEXT, primary_policy_number TEXT, primary_group_number TEXT,
        secondary_insurer TEXT, secondary_policy_number TEXT,
        recall_interval_months INT DEFAULT 6,
        last_exam_date DATE, last_cleaning_date DATE, next_recall_date DATE,
        preferred_provider TEXT,
        status TEXT DEFAULT 'active', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clinic_appointment (
        id SERIAL PRIMARY KEY, patient_id INT REFERENCES clinic_patient(id) ON DELETE CASCADE,
        provider_name TEXT NOT NULL, clinic_location TEXT,
        appointment_type TEXT NOT NULL,
        procedure_codes TEXT[],
        appointment_date DATE NOT NULL, appointment_time TIME,
        duration_minutes INT DEFAULT 60,
        status TEXT DEFAULT 'scheduled',
        chair_number INT, operatory TEXT,
        notes TEXT, treatment_notes TEXT,
        fee NUMERIC(8,2), insurance_estimate NUMERIC(8,2), patient_portion NUMERIC(8,2),
        submitted_to_insurance BOOLEAN DEFAULT false, insurance_paid NUMERIC(8,2),
        patient_paid NUMERIC(8,2), outstanding NUMERIC(8,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clinic_treatment_plan (
        id SERIAL PRIMARY KEY, patient_id INT REFERENCES clinic_patient(id),
        title TEXT NOT NULL, provider TEXT,
        total_estimated_fee NUMERIC(10,2), insurance_coverage_estimate NUMERIC(10,2),
        patient_responsibility NUMERIC(10,2),
        status TEXT DEFAULT 'proposed',
        priority TEXT DEFAULT 'normal',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clinic_treatment_item (
        id SERIAL PRIMARY KEY, plan_id INT REFERENCES clinic_treatment_plan(id) ON DELETE CASCADE,
        tooth_number TEXT, surface TEXT,
        procedure_code TEXT, description TEXT NOT NULL,
        fee NUMERIC(8,2), insurance_coverage NUMERIC(8,2),
        status TEXT DEFAULT 'pending',
        sequence_order INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clinic_recall (
        id SERIAL PRIMARY KEY, patient_id INT REFERENCES clinic_patient(id),
        recall_type TEXT DEFAULT 'cleaning', due_date DATE NOT NULL,
        reminder_sent BOOLEAN DEFAULT false, reminder_sent_at TIMESTAMPTZ,
        booked BOOLEAN DEFAULT false, appointment_id INT REFERENCES clinic_appointment(id),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM clinic_patient`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO clinic_patient (name, email, phone, date_of_birth, alberta_health_number, city, province, gender, allergies, primary_insurer, primary_policy_number, recall_interval_months, last_exam_date, last_cleaning_date, next_recall_date, preferred_provider, status)
        VALUES
          ('Emily Chen','emily.chen@email.ca','403-555-0201','1985-03-15','AHN-123456789','Calgary','AB','Female',ARRAY['Penicillin'],'Alberta Blue Cross','ABC-445678','AB-GRP-001',6,'2026-03-10','2026-03-10','2026-09-10','Dr. Amanda Lee','active'),
          ('Robert Nguyen','r.nguyen@email.ca','403-555-0202','1972-07-22','AHN-987654321','Calgary','AB','Male',ARRAY[]::TEXT[],'Manulife','MAN-789012','MAN-GRP-55',6,'2025-11-15','2025-11-15','2026-05-15','Dr. James Park','active'),
          ('Sarah Williams','sarah.w@email.ca','403-555-0203','1990-11-08','AHN-456789123','Calgary','AB','Female',ARRAY['Latex','Codeine'],'Sun Life','SL-334455','SL-GRP-22',3,'2026-06-20','2026-06-20','2026-09-20','Dr. Amanda Lee','active'),
          ('Marcus Johnson','m.johnson@email.ca','403-555-0204','1965-05-30','AHN-321654987','Calgary','AB','Male',ARRAY[]::TEXT[],'Alberta Blue Cross','ABC-998877','AB-GRP-001',12,'2025-08-01','2025-08-01','2026-08-01','Dr. James Park','active'),
          ('Priya Sharma','p.sharma@email.ca','403-555-0205','2001-09-14','AHN-654123789','Calgary','AB','Female',ARRAY[]::TEXT[],'No Insurance',NULL,NULL,6,'2026-01-10','2026-01-10','2026-07-10','Dr. Amanda Lee','active');
        INSERT INTO clinic_appointment (patient_id, provider_name, appointment_type, procedure_codes, appointment_date, appointment_time, duration_minutes, status, chair_number, fee, insurance_estimate, patient_portion)
        VALUES
          (1,'Dr. Amanda Lee','cleaning',ARRAY['D1110'],CURRENT_DATE,'09:00',60,'scheduled',1,185,148,37),
          (3,'Dr. Amanda Lee','exam',ARRAY['D0150','D0274'],CURRENT_DATE,'10:00',45,'arrived',2,320,256,64),
          (2,'Dr. James Park','filling',ARRAY['D2391'],CURRENT_DATE,'11:00',60,'in_service',3,280,224,56),
          (5,'Dr. Amanda Lee','consultation',ARRAY['D9310'],CURRENT_DATE,'14:00',30,'scheduled',4,95,0,95);
        INSERT INTO clinic_recall (patient_id, recall_type, due_date, reminder_sent, status)
        VALUES
          (4,'cleaning',CURRENT_DATE - 25,false,'pending'),
          (2,'cleaning',CURRENT_DATE - 10,true,'pending'),
          (1,'exam',CURRENT_DATE + 5,false,'pending');
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [apptRes, patientRes, recallRes, billingRes] = await Promise.all([
        client.query(`
          SELECT COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE) AS today_appointments,
            COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE AND status IN ('scheduled','confirmed','arrived','seated')) AS remaining_today,
            COALESCE(SUM(fee) FILTER (WHERE appointment_date = CURRENT_DATE AND status = 'completed'), 0) AS daily_production,
            COALESCE(SUM(outstanding) FILTER (WHERE submitted_to_insurance = true AND insurance_paid IS NULL), 0) AS insurance_pending
          FROM clinic_appointment
        `),
        client.query(`SELECT COUNT(*) AS total_patients, COUNT(*) FILTER (WHERE status = 'active') AS active_patients FROM clinic_patient`),
        client.query(`
          SELECT COUNT(*) AS overdue_recalls
          FROM clinic_recall
          WHERE status = 'pending' AND due_date < CURRENT_DATE
        `),
        client.query(`
          SELECT COALESCE(SUM(outstanding), 0) AS total_outstanding,
            COALESCE(SUM(patient_paid), 0) AS collected_today
          FROM clinic_appointment
          WHERE outstanding > 0
        `),
      ]);
      return Response.json({
        appointments: apptRes.rows[0],
        patients: patientRes.rows[0],
        recalls: recallRes.rows[0],
        billing: billingRes.rows[0],
      });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
