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
      CREATE TABLE IF NOT EXISTS vet_owner (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        preferred_contact TEXT DEFAULT 'phone' CHECK (preferred_contact IN ('phone','email','text')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vet_patient (
        id SERIAL PRIMARY KEY, owner_id INTEGER REFERENCES vet_owner(id),
        name TEXT NOT NULL, species TEXT NOT NULL CHECK (species IN ('dog','cat','bird','rabbit','reptile','fish','hamster','guinea_pig','horse','other')),
        breed TEXT, color TEXT, date_of_birth DATE, sex TEXT CHECK (sex IN ('male','female','unknown')),
        spayed_neutered BOOLEAN DEFAULT false, microchip_number TEXT,
        weight_kg DECIMAL(6,2), insurance_provider TEXT, insurance_policy TEXT,
        allergies TEXT, current_medications TEXT, status TEXT DEFAULT 'active' CHECK (status IN ('active','deceased','transferred')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vet_appointment (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES vet_patient(id),
        owner_id INTEGER REFERENCES vet_owner(id),
        appointment_type TEXT NOT NULL CHECK (appointment_type IN ('wellness','sick_visit','surgery','dental','vaccination','follow_up','euthanasia','grooming','boarding','other')),
        scheduled_at TIMESTAMPTZ NOT NULL, vet_name TEXT,
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','checked_in','in_progress','completed','cancelled','no_show')),
        chief_complaint TEXT, diagnosis TEXT, treatment_notes TEXT,
        follow_up_needed BOOLEAN DEFAULT false, follow_up_date DATE,
        total_amount DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vet_vaccination (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES vet_patient(id),
        vaccine_name TEXT NOT NULL, administered_date DATE NOT NULL,
        next_due_date DATE, administered_by TEXT, batch_number TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vet_prescription (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES vet_patient(id),
        appointment_id INTEGER REFERENCES vet_appointment(id),
        medication_name TEXT NOT NULL, dosage TEXT NOT NULL, frequency TEXT NOT NULL,
        duration_days INTEGER, refills_remaining INTEGER DEFAULT 0,
        prescribed_date DATE DEFAULT CURRENT_DATE, prescribed_by TEXT,
        dispensed BOOLEAN DEFAULT false, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM vet_owner`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO vet_owner (first_name, last_name, email, phone, address, city)
        VALUES
          ('Emma', 'Sullivan', 'emma.sullivan@email.ca', '403-555-4001', '88 Edgemont Blvd NW', 'Calgary'),
          ('Raj', 'Patel', 'raj.patel@email.ca', '403-555-4002', '234 Mahogany Blvd SE', 'Calgary'),
          ('Claire', 'Bouchard', 'claire.b@email.ca', '403-555-4003', '56 Panorama Hills Dr NW', 'Calgary')
      `);
      await client.query(`
        INSERT INTO vet_patient (owner_id, name, species, breed, date_of_birth, sex, spayed_neutered, weight_kg, status)
        VALUES
          (1, 'Biscuit', 'dog', 'Golden Retriever', '2019-04-15', 'female', true, 28.5, 'active'),
          (2, 'Sashi', 'cat', 'Siamese', '2020-08-22', 'male', true, 4.2, 'active'),
          (3, 'Coco', 'rabbit', 'Holland Lop', '2021-12-01', 'female', false, 1.8, 'active')
      `);
      await client.query(`
        INSERT INTO vet_appointment (patient_id, owner_id, appointment_type, scheduled_at, vet_name, status)
        VALUES
          (1, 1, 'wellness', NOW() + INTERVAL '2 hours', 'Dr. Sarah Kim', 'scheduled'),
          (2, 2, 'sick_visit', NOW() + INTERVAL '4 hours', 'Dr. Mark Thompson', 'confirmed'),
          (3, 3, 'vaccination', NOW() + INTERVAL '1 day', 'Dr. Sarah Kim', 'scheduled')
      `);
      await client.query(`
        INSERT INTO vet_vaccination (patient_id, vaccine_name, administered_date, next_due_date, administered_by)
        VALUES
          (1, 'DHPP', '2024-06-15', '2025-06-15', 'Dr. Sarah Kim'),
          (1, 'Rabies', '2024-06-15', '2027-06-15', 'Dr. Sarah Kim'),
          (2, 'FVRCP', '2024-03-20', '2025-03-20', 'Dr. Mark Thompson')
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
      const [apptToday, patients, vaccDue, revMtd] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM vet_appointment WHERE DATE(scheduled_at)=CURRENT_DATE AND status NOT IN ('cancelled','no_show')`),
        client.query(`SELECT COUNT(*) AS n FROM vet_patient WHERE status='active'`),
        client.query(`SELECT COUNT(*) AS n FROM vet_vaccination WHERE next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`),
        client.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM vet_appointment WHERE status='completed' AND DATE_TRUNC('month',scheduled_at)=DATE_TRUNC('month',NOW())`),
      ]);
      return Response.json({
        appointments_today: parseInt(apptToday.rows[0].n, 10),
        patients_active: parseInt(patients.rows[0].n, 10),
        vaccinations_due_30d: parseInt(vaccDue.rows[0].n, 10),
        revenue_mtd: parseFloat(revMtd.rows[0].total),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
