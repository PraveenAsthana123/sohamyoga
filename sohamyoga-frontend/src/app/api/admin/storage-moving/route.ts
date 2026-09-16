import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sm_customer (
      id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      email TEXT NOT NULL, phone TEXT NOT NULL,
      current_address TEXT, new_address TEXT,
      city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
      referral_source TEXT, customer_type TEXT DEFAULT 'residential'
        CHECK (customer_type IN ('residential','commercial','senior','student','military')),
      notes TEXT, total_jobs INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sm_move (
      id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES sm_customer(id),
      move_type TEXT NOT NULL CHECK (move_type IN ('local','long_distance','cross_province','international','office_move','student_move','senior_move','piano_move','specialty')),
      move_date DATE NOT NULL, move_time TIME DEFAULT '08:00',
      origin_address TEXT NOT NULL, origin_city TEXT,
      destination_address TEXT NOT NULL, destination_city TEXT,
      estimated_hours DECIMAL(5,2), actual_hours DECIMAL(5,2),
      crew_size INTEGER DEFAULT 2, truck_size TEXT DEFAULT '16ft'
        CHECK (truck_size IN ('16ft','20ft','26ft','tractor_trailer','cargo_van')),
      crew_members TEXT[], status TEXT DEFAULT 'quoted'
        CHECK (status IN ('quoted','booked','confirmed','in_progress','completed','cancelled')),
      quote_amount DECIMAL(10,2), final_amount DECIMAL(10,2),
      deposit_paid DECIMAL(10,2) DEFAULT 0, balance_paid BOOLEAN DEFAULT false,
      elevator_booking_required BOOLEAN DEFAULT false, packing_service BOOLEAN DEFAULT false,
      special_items TEXT[], storage_needed BOOLEAN DEFAULT false,
      customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
      customer_feedback TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sm_storage_unit (
      id SERIAL PRIMARY KEY, unit_number TEXT UNIQUE NOT NULL,
      unit_size TEXT NOT NULL CHECK (unit_size IN ('5x5','5x10','10x10','10x15','10x20','10x25','10x30')),
      unit_type TEXT DEFAULT 'standard' CHECK (unit_type IN ('standard','climate_controlled','drive_up','indoor')),
      monthly_rate DECIMAL(10,2) NOT NULL, floor TEXT, building TEXT,
      is_occupied BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sm_storage_rental (
      id SERIAL PRIMARY KEY, unit_id INTEGER REFERENCES sm_storage_unit(id),
      customer_id INTEGER REFERENCES sm_customer(id),
      start_date DATE NOT NULL, end_date DATE,
      monthly_rate DECIMAL(10,2) NOT NULL, security_deposit DECIMAL(10,2),
      access_code TEXT, status TEXT DEFAULT 'active'
        CHECK (status IN ('active','overdue','vacated','cancelled')),
      last_payment_date DATE, payment_method TEXT, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const weekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString().slice(0, 10);
    const [movesMonth, movesWeek, unitsTotal, unitsOccupied, revenueMtd, outstanding] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM sm_move WHERE move_date >= $1 AND status NOT IN ('cancelled')`, [monthStart]),
      client.query(`SELECT COUNT(*) AS n FROM sm_move WHERE move_date >= $1 AND status NOT IN ('cancelled')`, [weekStart]),
      client.query(`SELECT COUNT(*) AS n FROM sm_storage_unit`),
      client.query(`SELECT COUNT(*) AS n FROM sm_storage_unit WHERE is_occupied = true`),
      client.query(`SELECT COALESCE(SUM(final_amount),0) AS total FROM sm_move WHERE move_date >= $1 AND status = 'completed'`, [monthStart]),
      client.query(`SELECT COALESCE(SUM(quote_amount - deposit_paid),0) AS total FROM sm_move WHERE status IN ('booked','confirmed') AND balance_paid = false`),
    ]);
    const total = parseInt(unitsTotal.rows[0].n, 10);
    const occupied = parseInt(unitsOccupied.rows[0].n, 10);
    return Response.json({
      moves_this_month: parseInt(movesMonth.rows[0].n, 10),
      moves_this_week: parseInt(movesWeek.rows[0].n, 10),
      storage_units_occupied: occupied,
      storage_occupancy_pct: total > 0 ? Math.round((occupied / total) * 100) : 0,
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
      outstanding_balance: parseFloat(outstanding.rows[0].total),
    });
  } finally { client.release(); }
}
