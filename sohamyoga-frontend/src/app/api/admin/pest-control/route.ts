import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureCoreTables(client: import('pg').PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pc_customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text,
      phone text,
      address text,
      property_type text,
      account_type text DEFAULT 'one_time',
      service_plan text,
      contract_start date,
      contract_end date,
      pet_on_property boolean DEFAULT false,
      medical_sensitivities text,
      notes text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pc_technicians (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text,
      phone text,
      pesticide_license_number text,
      license_class text,
      license_expiry date,
      wcb_coverage boolean DEFAULT true,
      vehicle_plate text,
      status text DEFAULT 'available',
      notes text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pc_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid REFERENCES pc_customers(id) ON DELETE SET NULL,
      job_type text,
      pest_type text,
      status text DEFAULT 'scheduled',
      scheduled_date date,
      completed_date date,
      technician_id uuid REFERENCES pc_technicians(id) ON DELETE SET NULL,
      infestation_level text,
      products_used jsonb,
      treatment_method text,
      follow_up_required boolean DEFAULT false,
      follow_up_date date,
      labour_hours numeric,
      total_amount numeric,
      notes text,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pc_chemicals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_name text NOT NULL,
      pcpa_reg_number text,
      active_ingredient text,
      formulation_type text,
      target_pests text[],
      restricted_use boolean DEFAULT false,
      quantity_on_hand numeric,
      unit text,
      reorder_threshold numeric,
      cost_per_unit numeric,
      expiry_date date,
      notes text,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pc_service_agreements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid REFERENCES pc_customers(id) ON DELETE SET NULL,
      plan_name text,
      frequency text,
      services_included text[],
      price_per_visit numeric,
      annual_value numeric,
      start_date date,
      renewal_date date,
      status text DEFAULT 'active',
      auto_renew boolean DEFAULT true,
      notes text,
      created_at timestamptz DEFAULT now()
    );
  `);

  const { rows } = await client.query(`SELECT COUNT(*) AS n FROM pc_customers`);
  if (parseInt(rows[0].n, 10) === 0) {
    await client.query(`
      INSERT INTO pc_customers (name, email, phone, address, property_type, account_type, service_plan, contract_start, contract_end, pet_on_property, is_active)
      VALUES
        ('Hartman Properties Ltd.', 'owner@hartman.ca', '403-555-0101', '412 Harvest Hills Blvd NE, Calgary, AB', 'commercial', 'recurring', 'Quarterly Shield', '2026-01-01', '2026-12-31', false, true),
        ('Sandra Beaulieu', 'sandra.b@email.ca', '780-555-0202', '88 Ridgeway Cres, Edmonton, AB', 'residential', 'one_time', NULL, NULL, NULL, true, true),
        ('Prairie View Restaurant', 'mgr@prairieview.ca', '403-555-0303', '1220 Centre St NW, Calgary, AB', 'commercial', 'recurring', 'Monthly Pro', '2026-03-01', '2027-02-28', false, true),
        ('Kevin & Mara Olsen', 'kolsen@email.ca', '403-555-0404', '56 Sage Meadows Way NW, Calgary, AB', 'residential', 'annual', 'Annual Protect', '2026-06-01', '2027-05-31', true, true)
    `);
    await client.query(`
      INSERT INTO pc_technicians (name, email, phone, pesticide_license_number, license_class, license_expiry, wcb_coverage, vehicle_plate, status, is_active)
      VALUES
        ('Ryan Tran', 'ryan.tran@pest.ca', '403-555-1001', 'AB-PC-2021-00451', 'A', '2027-03-31', true, 'ABT 4491', 'available', true),
        ('Leila Mahmoud', 'leila.m@pest.ca', '403-555-1002', 'AB-PC-2022-00382', 'B', '2026-11-30', true, 'ABT 5512', 'on_job', true),
        ('Derek Fontaine', 'derek.f@pest.ca', '403-555-1003', 'AB-PC-2023-00119', 'C', '2027-06-30', true, 'ABT 6683', 'available', true)
    `);
    await client.query(`
      INSERT INTO pc_chemicals (product_name, pcpa_reg_number, active_ingredient, formulation_type, target_pests, restricted_use, quantity_on_hand, unit, reorder_threshold, cost_per_unit, expiry_date)
      VALUES
        ('Demand CS', '29117', 'Lambda-cyhalothrin', 'Capsule Suspension', ARRAY['spiders','ants','cockroaches'], false, 4.5, 'L', 2, 38.50, '2028-06-30'),
        ('Termidor SC', '28545', 'Fipronil', 'Suspension Concentrate', ARRAY['termites','ants'], true, 1.2, 'L', 1, 125.00, '2027-12-31'),
        ('Alpine WSG', '28843', 'Dinotefuran', 'Water-Soluble Granule', ARRAY['ants','cockroaches','bedbugs'], false, 18, 'kg', 5, 22.00, '2027-09-30'),
        ('Suspend Polyzone', '29451', 'Deltamethrin', 'Suspension Concentrate', ARRAY['fleas','ticks','ants'], false, 0.8, 'L', 2, 44.00, '2027-04-30')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureCoreTables(client);
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const [customers, jobsToday, jobsWeek, revMtd, chemLow, techs] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM pc_customers WHERE is_active = true`),
      client.query(`SELECT COUNT(*) AS n FROM pc_jobs WHERE scheduled_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM pc_jobs WHERE scheduled_date BETWEEN $1 AND $2`, [today, weekEnd]),
      client.query(`SELECT COALESCE(SUM(total_amount),0) AS rev FROM pc_jobs WHERE status='completed' AND completed_date >= $1`, [monthStart]),
      client.query(`SELECT COUNT(*) AS n FROM pc_chemicals WHERE quantity_on_hand <= reorder_threshold`),
      client.query(`SELECT COUNT(*) AS n FROM pc_technicians WHERE is_active = true`),
    ]);

    return Response.json({
      active_customers: Number(customers.rows[0].n),
      jobs_today: Number(jobsToday.rows[0].n),
      jobs_this_week: Number(jobsWeek.rows[0].n),
      revenue_mtd: Number(revMtd.rows[0].rev),
      chemical_low_stock_count: Number(chemLow.rows[0].n),
      technician_count: Number(techs.rows[0].n),
    });
  } catch (err) {
    console.error('pest-control GET error:', err);
    return Response.json({ error: 'Failed to fetch dashboard.' }, { status: 500 });
  } finally {
    client.release();
  }
}
