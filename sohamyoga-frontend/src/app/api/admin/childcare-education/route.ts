import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Alberta required ratios: infant 1:3, toddler 1:4, preschool 1:8, kindergarten 1:15
const REQUIRED_RATIOS: Record<string, number> = { infant: 3, toddler: 4, preschool: 8, kindergarten: 15, school_age: 15 };

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cc_child (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, date_of_birth DATE NOT NULL,
        age_group TEXT, room_name TEXT, group_name TEXT,
        parent1_name TEXT, parent1_email TEXT, parent1_phone TEXT, parent1_relation TEXT,
        parent2_name TEXT, parent2_email TEXT, parent2_phone TEXT, parent2_relation TEXT,
        emergency_contacts JSONB DEFAULT '[]',
        authorized_pickups TEXT[],
        allergies TEXT[], medical_conditions TEXT[], medications TEXT[],
        immunization_up_to_date BOOLEAN DEFAULT true, health_card_number TEXT,
        enrollment_date DATE, withdrawal_date DATE,
        schedule TEXT DEFAULT 'full_time',
        schedule_days TEXT[],
        daily_rate NUMERIC(6,2), monthly_fee NUMERIC(8,2),
        subsidy_applied BOOLEAN DEFAULT false, subsidy_amount NUMERIC(6,2),
        cwelcc_enrolled BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'enrolled',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cc_attendance (
        id SERIAL PRIMARY KEY, child_id INT REFERENCES cc_child(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        sign_in_time TIME, sign_out_time TIME,
        signed_in_by TEXT, signed_out_by TEXT,
        present BOOLEAN DEFAULT true, absent_reason TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cc_staff (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
        ecce_level TEXT, certification TEXT,
        employment_type TEXT DEFAULT 'full_time',
        assigned_room TEXT, hourly_rate NUMERIC(6,2),
        first_aid_expiry DATE, criminal_record_check_date DATE,
        status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cc_daily_report (
        id SERIAL PRIMARY KEY, child_id INT REFERENCES cc_child(id),
        report_date DATE DEFAULT CURRENT_DATE,
        meals JSONB DEFAULT '{}',
        nap_start TIME, nap_end TIME, nap_quality TEXT,
        mood TEXT,
        activities TEXT[],
        toileting_notes TEXT, diaper_changes INT,
        notes TEXT,
        created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cc_incident (
        id SERIAL PRIMARY KEY, child_id INT REFERENCES cc_child(id),
        incident_date DATE DEFAULT CURRENT_DATE, incident_time TIME,
        type TEXT,
        description TEXT, action_taken TEXT,
        parent_notified BOOLEAN DEFAULT false, parent_notified_at TIMESTAMPTZ,
        reported_by TEXT, witness TEXT,
        requires_licensing_report BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM cc_child`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO cc_child (name, date_of_birth, age_group, room_name, parent1_name, parent1_email, parent1_phone, parent1_relation, allergies, schedule, schedule_days, daily_rate, monthly_fee, subsidy_applied, cwelcc_enrolled, status, enrollment_date)
        VALUES
          ('Sofia Martinez','2023-08-15','infant','Sunflower Room','Maria Martinez','m.martinez@email.ca','403-555-0301','Mother',ARRAY['Dairy'],'full_time',ARRAY['mon','tue','wed','thu','fri'],35,700,true,true,'enrolled',CURRENT_DATE - 90),
          ('Liam Chen','2022-03-22','toddler','Rainbow Room','Wei Chen','w.chen@email.ca','403-555-0302','Father',ARRAY[]::TEXT[],'full_time',ARRAY['mon','tue','wed','thu','fri'],32,640,false,true,'enrolled',CURRENT_DATE - 180),
          ('Aiden Patel','2021-11-05','preschool','Sunshine Room','Priya Patel','p.patel@email.ca','403-555-0303','Mother',ARRAY['Peanuts','Tree Nuts'],'part_time',ARRAY['mon','wed','fri'],20,400,true,false,'enrolled',CURRENT_DATE - 60),
          ('Emma Thompson','2019-06-18','kindergarten','Discovery Room','James Thompson','j.thompson@email.ca','403-555-0304','Father',ARRAY[]::TEXT[],'full_time',ARRAY['mon','tue','wed','thu','fri'],28,560,false,true,'enrolled',CURRENT_DATE - 365),
          ('Noah Kim','2023-01-30','infant','Sunflower Room','Ji-Soo Kim','j.kim@email.ca','403-555-0305','Mother',ARRAY[]::TEXT[],'full_time',ARRAY['mon','tue','wed','thu','fri'],35,700,false,true,'enrolled',CURRENT_DATE - 45);
        INSERT INTO cc_staff (name, role, ecce_level, certification, employment_type, assigned_room, hourly_rate, first_aid_expiry, criminal_record_check_date, status)
        VALUES
          ('Susan Park','ecce_educator','Level 3','Alberta ECCE Level 3','full_time','Sunflower Room',24.50,'2027-06-30','2025-09-01','active'),
          ('Maria Santos','ecce_educator','Level 2','Alberta ECCE Level 2','full_time','Rainbow Room',21.00,'2026-11-15','2025-08-15','active'),
          ('Jennifer Lee','ecce_educator','Level 3','Alberta ECCE Level 3','full_time','Sunshine Room',24.50,'2027-03-20','2025-07-01','active'),
          ('Kevin Zhang','ecce_assistant','Level 1','Alberta ECCE Level 1','full_time','Discovery Room',17.50,'2026-06-30','2025-08-20','active'),
          ('Amanda Wilson','director','Level 3','Alberta Director Certificate','full_time','Admin',28.00,'2027-09-15','2025-06-01','active');
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
      const [enrollRes, attRes, staffRes, incidentRes] = await Promise.all([
        client.query(`
          SELECT age_group, COUNT(*) AS enrolled
          FROM cc_child WHERE status = 'enrolled'
          GROUP BY age_group ORDER BY age_group
        `),
        client.query(`
          SELECT COUNT(*) AS present_today
          FROM cc_attendance
          WHERE date = CURRENT_DATE AND present = true
        `),
        client.query(`SELECT COUNT(*) AS total_staff FROM cc_staff WHERE status = 'active'`),
        client.query(`SELECT COUNT(*) AS incidents_today FROM cc_incident WHERE incident_date = CURRENT_DATE`),
      ]);

      // Calculate subsidy billing
      const billingRes = await client.query(`
        SELECT
          COALESCE(SUM(monthly_fee), 0) AS total_monthly_fees,
          COALESCE(SUM(subsidy_amount), 0) AS total_subsidy,
          COUNT(*) FILTER (WHERE cwelcc_enrolled = true) AS cwelcc_count
        FROM cc_child WHERE status = 'enrolled'
      `);

      return Response.json({
        enrolled_by_age: enrollRes.rows,
        attendance: attRes.rows[0],
        staff: staffRes.rows[0],
        incidents: incidentRes.rows[0],
        billing: billingRes.rows[0],
        required_ratios: REQUIRED_RATIOS,
      });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
