import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ls_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, address TEXT NOT NULL,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB', postal_code TEXT,
        property_type TEXT DEFAULT 'residential' CHECK (property_type IN ('residential','commercial','condo','strata','municipal')),
        lot_size_sqft INTEGER, has_irrigation BOOLEAN DEFAULT false, fence_type TEXT,
        gate_code TEXT, dog_on_property BOOLEAN DEFAULT false, special_notes TEXT,
        services_subscribed TEXT[] DEFAULT ARRAY['lawn_care'],
        seasonal_contract_value DECIMAL(10,2), contract_type TEXT DEFAULT 'seasonal'
          CHECK (contract_type IN ('seasonal','monthly','per_visit','annual')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','seasonal_pause','cancelled')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ls_job (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES ls_client(id),
        service_type TEXT NOT NULL CHECK (service_type IN ('lawn_mowing','snow_removal','spring_cleanup','fall_cleanup','fertilizing','aeration','overseeding','hedge_trimming','tree_pruning','irrigation_startup','irrigation_winterize','sod_installation','flower_bed','mulching','power_washing','other')),
        job_date DATE NOT NULL, scheduled_time TIME,
        crew_size INTEGER DEFAULT 2, crew_members TEXT[],
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','en_route','in_progress','completed','cancelled','weather_hold')),
        duration_minutes INTEGER, price DECIMAL(10,2) NOT NULL,
        materials_cost DECIMAL(10,2) DEFAULT 0, tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','invoiced','paid','overdue')),
        before_photo_url TEXT, after_photo_url TEXT,
        quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ls_equipment (
        id SERIAL PRIMARY KEY, equipment_name TEXT NOT NULL,
        equipment_type TEXT CHECK (equipment_type IN ('mower','snow_blower','plow_truck','trailer','trimmer','edger','blower','spreader','aerator','sprayer','other')),
        make TEXT, model TEXT, year INTEGER, serial_number TEXT,
        status TEXT DEFAULT 'operational' CHECK (status IN ('operational','maintenance','repair','retired')),
        last_service_date DATE, next_service_date DATE, fuel_type TEXT,
        purchase_date DATE, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ls_route (
        id SERIAL PRIMARY KEY, route_name TEXT NOT NULL, route_date DATE NOT NULL,
        crew_lead TEXT NOT NULL, vehicle TEXT,
        job_ids INTEGER[],
        status TEXT DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed')),
        estimated_hours DECIMAL(5,2), actual_hours DECIMAL(5,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const [jobsToday, crewInField, revMtd, equip, weatherHolds] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM ls_job WHERE job_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM ls_job WHERE job_date = $1 AND status IN ('en_route','in_progress')`, [today]),
      client.query(`SELECT COALESCE(SUM(price + COALESCE(tip_amount,0)),0) AS total FROM ls_job WHERE date_trunc('month', job_date) = date_trunc('month', NOW()) AND status = 'completed'`),
      client.query(`SELECT COUNT(*) AS n FROM ls_equipment WHERE next_service_date <= CURRENT_DATE + INTERVAL '14 days' AND status != 'retired'`),
      client.query(`SELECT COUNT(*) AS n FROM ls_job WHERE job_date = $1 AND status = 'weather_hold'`, [today]),
    ]);
    const todayJobs = await client.query(`
      SELECT j.*, c.first_name || ' ' || c.last_name AS client_name, c.address
      FROM ls_job j LEFT JOIN ls_client c ON c.id = j.client_id
      WHERE j.job_date = $1 ORDER BY j.scheduled_time
    `, [today]);
    return NextResponse.json({
      jobs_today: parseInt(jobsToday.rows[0].n),
      crew_in_field: parseInt(crewInField.rows[0].n),
      revenue_mtd: parseFloat(revMtd.rows[0].total),
      equipment_needing_service: parseInt(equip.rows[0].n),
      weather_holds_today: parseInt(weatherHolds.rows[0].n),
      today_jobs: todayJobs.rows,
    });
  } finally {
    client.release();
  }
}
