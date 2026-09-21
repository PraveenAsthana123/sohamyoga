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
      CREATE TABLE IF NOT EXISTS rx_patient (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL, health_card_number TEXT,
        phone TEXT NOT NULL, email TEXT, address TEXT, city TEXT DEFAULT 'Calgary',
        province TEXT DEFAULT 'AB', postal_code TEXT,
        allergies TEXT[], current_conditions TEXT[],
        insurance_provider TEXT, insurance_id TEXT, insurance_group TEXT,
        preferred_pharmacist TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rx_prescription (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES rx_patient(id),
        din TEXT, drug_name TEXT NOT NULL, brand_name TEXT,
        strength TEXT NOT NULL, form TEXT, quantity INTEGER NOT NULL,
        days_supply INTEGER, refills_authorized INTEGER DEFAULT 0,
        refills_remaining INTEGER DEFAULT 0, directions TEXT NOT NULL,
        prescriber_name TEXT NOT NULL, prescriber_license TEXT,
        prescriber_phone TEXT, written_date DATE NOT NULL,
        status TEXT DEFAULT 'new' CHECK (status IN ('new','on_hold','ready','dispensed','partial','expired','cancelled')),
        insurance_claim_status TEXT DEFAULT 'not_submitted'
          CHECK (insurance_claim_status IN ('not_submitted','submitted','approved','rejected','manual_claim')),
        patient_cost DECIMAL(10,2), insurance_paid DECIMAL(10,2),
        dispensed_at TIMESTAMPTZ, dispensed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rx_inventory (
        id SERIAL PRIMARY KEY, din TEXT UNIQUE NOT NULL, drug_name TEXT NOT NULL,
        brand_name TEXT, manufacturer TEXT, strength TEXT, form TEXT,
        quantity_on_hand INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 50,
        reorder_quantity INTEGER DEFAULT 200, unit_cost DECIMAL(10,2),
        selling_price DECIMAL(10,2), location TEXT,
        expiry_date DATE, narcotic BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rx_interaction_log (
        id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES rx_patient(id),
        prescription_id INTEGER REFERENCES rx_prescription(id),
        interaction_type TEXT CHECK (interaction_type IN ('drug_drug','drug_allergy','drug_condition','duplicate_therapy')),
        severity TEXT CHECK (severity IN ('minor','moderate','severe','contraindicated')),
        description TEXT, overridden BOOLEAN DEFAULT false, override_reason TEXT,
        checked_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [prescToday, readyPickup, lowStock, refillsDue] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM rx_prescription WHERE created_at::date = $1`, [today]),
      client.query(`SELECT COUNT(*) FROM rx_prescription WHERE status = 'ready'`),
      client.query(`SELECT COUNT(*) FROM rx_inventory WHERE quantity_on_hand <= reorder_point`),
      client.query(`SELECT COUNT(*) FROM rx_prescription WHERE status = 'dispensed' AND refills_remaining > 0 AND dispensed_at::date <= (NOW() - INTERVAL '7 days')::date`),
    ]);
    return Response.json({
      prescriptions_today: parseInt(prescToday.rows[0].count),
      ready_for_pickup: parseInt(readyPickup.rows[0].count),
      low_stock_count: parseInt(lowStock.rows[0].count),
      refills_due_7d: parseInt(refillsDue.rows[0].count),
    });
  } finally {
    client.release();
  }
}
