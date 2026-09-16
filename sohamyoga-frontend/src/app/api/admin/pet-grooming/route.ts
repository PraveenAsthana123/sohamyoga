import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pg_owner (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, address TEXT,
        emergency_contact_name TEXT, emergency_contact_phone TEXT,
        vet_name TEXT, vet_phone TEXT, vet_clinic TEXT,
        notes TEXT, total_visits INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pg_pet (
        id SERIAL PRIMARY KEY, owner_id INTEGER REFERENCES pg_owner(id),
        name TEXT NOT NULL, species TEXT DEFAULT 'dog' CHECK (species IN ('dog','cat','rabbit','guinea_pig','bird','other')),
        breed TEXT, color TEXT, date_of_birth DATE, sex TEXT CHECK (sex IN ('male','female')),
        weight_kg DECIMAL(6,2), spayed_neutered BOOLEAN DEFAULT false,
        vaccination_status TEXT DEFAULT 'unknown' CHECK (vaccination_status IN ('current','expired','unknown')),
        rabies_expiry DATE, bordetella_expiry DATE, distemper_expiry DATE,
        behavioural_notes TEXT, grooming_notes TEXT, allergies TEXT,
        last_visit DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pg_appointment (
        id SERIAL PRIMARY KEY, pet_id INTEGER REFERENCES pg_pet(id),
        owner_id INTEGER REFERENCES pg_owner(id),
        service_type TEXT NOT NULL CHECK (service_type IN ('full_groom','bath_brush','nail_trim','ear_cleaning','teeth_brushing','de_shed','de_mat','lion_cut','boarding_night','daycare','spa_treatment')),
        scheduled_at TIMESTAMPTZ NOT NULL, groomer TEXT,
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','in_progress','ready_for_pickup','completed','cancelled','no_show')),
        price DECIMAL(10,2), tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT, duration_minutes INTEGER,
        before_photo_url TEXT, after_photo_url TEXT,
        groomer_notes TEXT, owner_rating INTEGER CHECK (owner_rating BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pg_boarding (
        id SERIAL PRIMARY KEY, pet_id INTEGER REFERENCES pg_pet(id),
        owner_id INTEGER REFERENCES pg_owner(id),
        check_in_date DATE NOT NULL, check_out_date DATE NOT NULL,
        kennel_number TEXT, daily_rate DECIMAL(10,2),
        feeding_instructions TEXT, medication_instructions TEXT,
        exercise_level TEXT DEFAULT 'standard' CHECK (exercise_level IN ('minimal','standard','active')),
        status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved','checked_in','checked_out','cancelled')),
        special_requests TEXT, total_amount DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [appts, boarding, revenue, vaccExpiry] = await Promise.all([
      client.query(`
        SELECT COUNT(*) AS appointments_today
        FROM pg_appointment
        WHERE DATE(scheduled_at) = CURRENT_DATE
          AND status NOT IN ('cancelled','no_show')
      `),
      client.query(`
        SELECT COUNT(*) AS pets_boarding_now
        FROM pg_boarding
        WHERE status = 'checked_in'
      `),
      client.query(`
        SELECT COALESCE(SUM(price + COALESCE(tip_amount,0)), 0) AS revenue_today
        FROM pg_appointment
        WHERE DATE(scheduled_at) = CURRENT_DATE AND status = 'completed'
      `),
      client.query(`
        SELECT COUNT(DISTINCT p.id) AS vaccination_expiring_30d
        FROM pg_pet p
        WHERE (p.rabies_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
           OR (p.bordetella_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
           OR (p.distemper_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
      `),
    ]);
    return Response.json({
      appointments_today: parseInt(appts.rows[0].appointments_today),
      pets_boarding_now: parseInt(boarding.rows[0].pets_boarding_now),
      revenue_today: parseFloat(revenue.rows[0].revenue_today),
      vaccination_expiring_30d: parseInt(vaccExpiry.rows[0].vaccination_expiring_30d),
    });
  } finally {
    client.release();
  }
}
