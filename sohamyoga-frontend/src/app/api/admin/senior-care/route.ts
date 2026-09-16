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
      CREATE TABLE IF NOT EXISTS sc_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE, phone TEXT, address TEXT, city TEXT DEFAULT 'Calgary',
        province TEXT DEFAULT 'AB', postal_code TEXT,
        care_level TEXT DEFAULT 'companion' CHECK (care_level IN ('companion','personal_care','medical_support','dementia','palliative','respite')),
        primary_condition TEXT, secondary_conditions TEXT[],
        physician_name TEXT, physician_phone TEXT,
        emergency_contact_name TEXT NOT NULL, emergency_contact_phone TEXT NOT NULL, emergency_contact_relation TEXT,
        preferred_language TEXT DEFAULT 'English',
        aish_recipient BOOLEAN DEFAULT false, alberta_seniors_benefit BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','discharged','deceased')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sc_caregiver (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL,
        certification TEXT[],
        languages TEXT[], availability_days TEXT[],
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated')),
        hourly_rate DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sc_schedule (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES sc_client(id),
        caregiver_id INTEGER REFERENCES sc_caregiver(id),
        visit_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
        care_type TEXT NOT NULL CHECK (care_type IN ('companion','personal_hygiene','medication_reminder','meal_prep','light_housekeeping','transportation','medical_escort','respite')),
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','missed','cancelled')),
        notes TEXT, actual_start_time TIME, actual_end_time TIME,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sc_care_note (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES sc_client(id),
        caregiver_id INTEGER REFERENCES sc_caregiver(id),
        visit_date DATE NOT NULL, mood TEXT, appetite TEXT, mobility TEXT,
        medications_taken BOOLEAN DEFAULT true, incidents TEXT,
        activities_completed TEXT[], general_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM sc_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO sc_client (first_name, last_name, date_of_birth, phone, address, city, care_level, primary_condition, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, aish_recipient, alberta_seniors_benefit, status)
        VALUES
          ('Margaret', 'Thompson', '1938-05-12', '403-555-2001', '112 Balmoral Dr NW', 'Calgary', 'personal_care', 'Parkinson''s Disease', 'Susan Thompson', '403-555-2011', 'Daughter', false, true, 'active'),
          ('Harold', 'Kowalski', '1942-11-30', '403-555-2002', '445 Richmond Rd SW', 'Calgary', 'dementia', 'Alzheimer''s Disease', 'Jan Kowalski', '403-555-2012', 'Spouse', false, true, 'active'),
          ('Dorothy', 'Chen', '1950-03-08', '403-555-2003', '78 Ranchlands Blvd NW', 'Calgary', 'companion', 'Diabetes Type 2', 'Michael Chen', '403-555-2013', 'Son', false, true, 'active')
      `);
      await client.query(`
        INSERT INTO sc_caregiver (first_name, last_name, email, phone, certification, languages, availability_days, status, hourly_rate)
        VALUES
          ('Priya', 'Sharma', 'priya.sharma@carehub.ca', '403-555-3001', ARRAY['PSW','HCA'], ARRAY['English','Hindi','Punjabi'], ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 'active', 22.50),
          ('James', 'Okafor', 'james.okafor@carehub.ca', '403-555-3002', ARRAY['PSW','CPR'], ARRAY['English','French'], ARRAY['Monday','Wednesday','Friday','Saturday','Sunday'], 'active', 21.00),
          ('Maria', 'Garcia', 'maria.garcia@carehub.ca', '403-555-3003', ARRAY['LPN'], ARRAY['English','Spanish'], ARRAY['Tuesday','Thursday','Saturday'], 'active', 32.00)
      `);
      await client.query(`
        INSERT INTO sc_schedule (client_id, caregiver_id, visit_date, start_time, end_time, care_type, status)
        VALUES
          (1, 1, CURRENT_DATE, '09:00', '11:00', 'personal_hygiene', 'scheduled'),
          (2, 2, CURRENT_DATE, '10:00', '12:00', 'companion', 'confirmed'),
          (3, 3, CURRENT_DATE + 1, '14:00', '16:00', 'medication_reminder', 'scheduled')
      `);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [clients, today, missed, caregivers] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM sc_client WHERE status='active'`),
        client.query(`SELECT COUNT(*) AS n FROM sc_schedule WHERE visit_date=CURRENT_DATE AND status IN ('scheduled','confirmed','in_progress')`),
        client.query(`SELECT COUNT(*) AS n FROM sc_schedule WHERE status='missed' AND DATE_TRUNC('month',visit_date)=DATE_TRUNC('month',NOW())`),
        client.query(`SELECT COUNT(*) AS n FROM sc_caregiver WHERE status='active'`),
      ]);
      return Response.json({
        active_clients: parseInt(clients.rows[0].n, 10),
        visits_today: parseInt(today.rows[0].n, 10),
        missed_visits_mtd: parseInt(missed.rows[0].n, 10),
        caregivers_active: parseInt(caregivers.rows[0].n, 10),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
