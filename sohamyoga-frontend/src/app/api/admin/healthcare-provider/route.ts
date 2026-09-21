import type { PoolClient } from 'pg';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureTables(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS healthcare_patient (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
      date_of_birth DATE, health_card_number TEXT, province TEXT DEFAULT 'AB',
      alberta_health_number TEXT,
      emergency_contact TEXT, emergency_phone TEXT,
      allergies TEXT[], medications TEXT[], conditions TEXT[],
      insurance_provider TEXT,
      insurance_policy_number TEXT, insurance_group_number TEXT,
      status TEXT DEFAULT 'active',
      preferred_provider TEXT,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS healthcare_appointment (
      id SERIAL PRIMARY KEY, patient_id INT REFERENCES healthcare_patient(id) ON DELETE CASCADE,
      provider_name TEXT, service_type TEXT NOT NULL,
      appointment_date TIMESTAMPTZ NOT NULL, duration_minutes INT DEFAULT 30,
      status TEXT DEFAULT 'scheduled',
      notes TEXT, treatment_notes TEXT,
      fee NUMERIC(8,2), insurance_covered NUMERIC(8,2), patient_paid NUMERIC(8,2),
      follow_up_required BOOLEAN DEFAULT false, follow_up_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS healthcare_claim (
      id SERIAL PRIMARY KEY, appointment_id INT REFERENCES healthcare_appointment(id),
      patient_id INT REFERENCES healthcare_patient(id),
      insurer TEXT, policy_number TEXT, claim_amount NUMERIC(8,2),
      approved_amount NUMERIC(8,2), status TEXT DEFAULT 'pending',
      submitted_date DATE, payment_date DATE, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await getPool().connect();
  try {
    await ensureTables(client);

    const [statsRow, patients, todayAppts, pendingClaims, followUps] = await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM healthcare_patient WHERE status='active') AS active_patients,
          (SELECT COUNT(*) FROM healthcare_appointment WHERE appointment_date::date = CURRENT_DATE) AS today_appointments,
          (SELECT COALESCE(SUM(patient_paid),0) FROM healthcare_appointment WHERE appointment_date::date = CURRENT_DATE AND status='completed') AS revenue_today,
          (SELECT COALESCE(SUM(claim_amount),0) FROM healthcare_claim WHERE status='pending') AS pending_claims_value
      `),
      client.query(`SELECT id, name, email, phone, province, insurance_provider, status, preferred_provider, created_at FROM healthcare_patient ORDER BY created_at DESC LIMIT 100`),
      client.query(`SELECT ha.*, hp.name AS patient_name FROM healthcare_appointment ha LEFT JOIN healthcare_patient hp ON hp.id=ha.patient_id WHERE ha.appointment_date::date=CURRENT_DATE ORDER BY ha.appointment_date`),
      client.query(`SELECT COUNT(*) AS cnt, COALESCE(SUM(claim_amount),0) AS total FROM healthcare_claim WHERE status='pending'`),
      client.query(`SELECT ha.id, ha.follow_up_date, hp.name AS patient_name, ha.provider_name FROM healthcare_appointment ha LEFT JOIN healthcare_patient hp ON hp.id=ha.patient_id WHERE ha.follow_up_required=true AND ha.follow_up_date <= CURRENT_DATE + INTERVAL '7 days' AND ha.follow_up_date >= CURRENT_DATE ORDER BY ha.follow_up_date`),
    ]);

    return Response.json({
      stats: statsRow.rows[0],
      patients: patients.rows,
      todayAppointments: todayAppts.rows,
      pendingClaims: pendingClaims.rows[0],
      followUps: followUps.rows,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await getPool().connect();
  try {
    await ensureTables(client);
    const body = await req.json();
    const { name, email, phone, date_of_birth, health_card_number, province, alberta_health_number,
      emergency_contact, emergency_phone, allergies, medications, conditions,
      insurance_provider, insurance_policy_number, insurance_group_number,
      status, preferred_provider, notes } = body;

    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO healthcare_patient (name,email,phone,date_of_birth,health_card_number,province,alberta_health_number,
        emergency_contact,emergency_phone,allergies,medications,conditions,
        insurance_provider,insurance_policy_number,insurance_group_number,status,preferred_provider,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [name,email,phone,date_of_birth,health_card_number,province||'AB',alberta_health_number,
        emergency_contact,emergency_phone,allergies||[],medications||[],conditions||[],
        insurance_provider,insurance_policy_number,insurance_group_number,status||'active',preferred_provider,notes]);

    return Response.json({ patient: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
