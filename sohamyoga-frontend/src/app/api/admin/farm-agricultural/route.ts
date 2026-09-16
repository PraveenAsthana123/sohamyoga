import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ag_clients (
        id SERIAL PRIMARY KEY,
        farm_name TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        municipality TEXT,
        province TEXT DEFAULT 'AB',
        quarter_sections TEXT[],
        total_acres NUMERIC(10,2),
        operation_type TEXT DEFAULT 'grain',
        primary_crops TEXT[],
        livestock_types TEXT[],
        afsc_policy_number TEXT,
        carbon_credit_enrolled BOOLEAN DEFAULT false,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ag_fields (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES ag_clients(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        legal_description TEXT,
        acres NUMERIC(8,2),
        soil_zone TEXT DEFAULT 'black',
        irrigation BOOLEAN DEFAULT false,
        crop_this_year TEXT,
        crop_last_year TEXT,
        seeding_date DATE,
        expected_harvest_date DATE,
        yield_estimate_bu_ac NUMERIC(6,2),
        actual_yield_bu_ac NUMERIC(6,2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ag_jobs (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES ag_clients(id) ON DELETE CASCADE,
        field_id INT REFERENCES ag_fields(id) ON DELETE SET NULL,
        job_type TEXT DEFAULT 'seeding',
        status TEXT DEFAULT 'scheduled',
        scheduled_date DATE,
        completed_date DATE,
        operator_name TEXT,
        equipment_used TEXT,
        product_applied TEXT,
        rate_per_ac NUMERIC(8,2),
        acres_done NUMERIC(8,2),
        total_cost NUMERIC(10,2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ag_equipment (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'tractor',
        make TEXT,
        model TEXT,
        year INT,
        serial_number TEXT,
        hours_meter NUMERIC(8,1),
        next_service_hours NUMERIC(8,1),
        next_service_date DATE,
        condition TEXT DEFAULT 'good',
        insurance_expiry DATE,
        notes TEXT,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ag_grain_contracts (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES ag_clients(id) ON DELETE CASCADE,
        commodity TEXT NOT NULL,
        contract_type TEXT DEFAULT 'basis',
        bushels_contracted NUMERIC(10,2),
        price_per_bu NUMERIC(8,4),
        basis_level NUMERIC(8,4),
        delivery_start DATE,
        delivery_end DATE,
        buyer_name TEXT,
        elevator_location TEXT,
        status TEXT DEFAULT 'open',
        bushels_delivered NUMERIC(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM ag_clients`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO ag_clients (farm_name, operator_name, email, phone, address, municipality, province, quarter_sections, total_acres, operation_type, primary_crops, livestock_types, afsc_policy_number, carbon_credit_enrolled, notes)
        VALUES
          ('Sunrise Prairie Farms', 'Dale Kowalski', 'dale@sunriseprairie.ca', '403-555-1001', 'Hwy 21, Box 44', 'Vulcan County', 'AB', ARRAY['NW-12-18-23-W4','SW-12-18-23-W4'], 1840, 'grain', ARRAY['wheat','canola','barley'], NULL, 'AFSC-2026-441290', true, 'NERP enrolled, carbon credits verified annually'),
          ('Riverbend Mixed Operations', 'Janet & Tom Riverbend', 'info@riverbendops.ca', '403-555-1002', 'RR 1-4, Box 22', 'Ponoka County', 'AB', ARRAY['SE-04-42-26-W4','NE-04-42-26-W4','NW-05-42-26-W4'], 3200, 'mixed', ARRAY['wheat','canola'], ARRAY['beef cattle','hogs'], 'AFSC-2026-338712', false, 'CFIA premises ID: AB1234567'),
          ('High River Organics', 'Priya Sharma', 'priya@hrorganics.ca', '403-555-1003', 'Box 88 SW', 'Foothills County', 'AB', ARRAY['SW-22-20-28-W4'], 480, 'organic', ARRAY['oats','lentils','flax'], NULL, NULL, false, 'Certified organic since 2021, sells direct to Calgary Coop'),
          ('Lethbridge Feeders Ltd.', 'Brad & Cindy Lethbridge', 'ops@lethbridgefeeders.ca', '403-555-1004', 'Rural Rt 5', 'Lethbridge County', 'AB', ARRAY['NE-33-08-22-W4','SE-33-08-22-W4'], 960, 'livestock', NULL, ARRAY['beef cattle'], 'AFSC-2026-227401', true, 'Irrigation water license LIC-9922, center pivots x4'),
          ('Peace River Grain LLC', 'Marcus Olsen', 'marcus@peacerivergrain.ca', '780-555-1005', 'Hwy 2N, Box 199', 'Peace River', 'AB', ARRAY['NW-09-84-18-W5','SW-09-84-18-W5','NE-10-84-18-W5'], 2600, 'grain', ARRAY['wheat','canola','peas','oats'], NULL, 'AFSC-2026-119833', true, 'Northern growing conditions, hail season June–August')
      `);
      await client.query(`
        INSERT INTO ag_fields (client_id, field_name, legal_description, acres, soil_zone, irrigation, crop_this_year, crop_last_year, seeding_date, expected_harvest_date, yield_estimate_bu_ac)
        VALUES
          (1, 'North Quarter', 'NW-12-18-23-W4', 160, 'black', false, 'canola', 'wheat', '2026-05-15', '2026-09-10', 45),
          (1, 'South Quarter', 'SW-12-18-23-W4', 160, 'dark_brown', false, 'wheat', 'canola', '2026-05-20', '2026-08-25', 55),
          (2, 'River Bottom', 'SE-04-42-26-W4', 320, 'black', false, 'wheat', 'barley', '2026-05-12', '2026-08-30', 62),
          (4, 'Pivot Field A', 'NE-33-08-22-W4', 130, 'brown', true, 'corn', 'alfalfa', '2026-06-01', '2026-10-15', 180)
      `);
      await client.query(`
        INSERT INTO ag_equipment (name, type, make, model, year, serial_number, hours_meter, next_service_hours, next_service_date, condition, insurance_expiry)
        VALUES
          ('JD 9R-540 Tractor', 'tractor', 'John Deere', '9R-540', 2022, 'SN1RW540R22001234', 1840, 2000, '2027-03-01', 'excellent', '2027-01-15'),
          ('Case IH 9250 Combine', 'combine', 'Case IH', '9250', 2020, 'Y9T250RSN0002222', 1200, 1500, '2026-10-01', 'good', '2027-01-15'),
          ('Apache AS1020 Sprayer', 'sprayer', 'Apache', 'AS1020', 2021, 'APCH1020ABC33334', 620, 750, '2026-11-01', 'good', '2027-01-15'),
          ('Morris Quantum 40 Seeder', 'seeder', 'Morris', 'Quantum 40', 2019, 'MRQ40SN5556666', 0, 0, NULL, 'fair', '2027-01-15'),
          ('Kenworth T680 Grain Truck', 'truck', 'Kenworth', 'T680', 2018, 'KWT680VIN7778888', 245000, 275000, '2027-02-01', 'good', '2027-01-15')
      `);
      await client.query(`
        INSERT INTO ag_grain_contracts (client_id, commodity, contract_type, bushels_contracted, price_per_bu, basis_level, delivery_start, delivery_end, buyer_name, elevator_location, status, bushels_delivered)
        VALUES
          (1, 'canola', 'basis', 15000, 12.45, -0.85, '2026-09-15', '2026-11-30', 'Richardson Pioneer', 'Vulcan AB', 'open', 0),
          (1, 'wheat', 'flat_price', 25000, 7.80, NULL, '2026-08-15', '2026-10-31', 'Viterra', 'Lethbridge AB', 'partial', 12000),
          (5, 'canola', 'basis', 40000, 12.20, -1.10, '2026-09-01', '2026-12-31', 'Cargill', 'Peace River AB', 'open', 0),
          (5, 'wheat', 'pool', 30000, 7.60, NULL, '2026-08-01', '2026-10-31', 'CWB Pool', 'Peace River AB', 'partial', 8000)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [totalClients, activeFields, acresMgmt, cropInsurance, eqWeek, revMtd] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM ag_clients WHERE is_active=true`),
        client.query(`SELECT COUNT(*) AS n FROM ag_fields WHERE crop_this_year IS NOT NULL`),
        client.query(`SELECT COALESCE(SUM(total_acres),0) AS acres FROM ag_clients WHERE is_active=true`),
        client.query(`SELECT COUNT(*) AS n FROM ag_clients WHERE afsc_policy_number IS NOT NULL AND is_active=true`),
        client.query(`SELECT COUNT(*) AS n FROM ag_jobs WHERE status='scheduled' AND scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7`),
        client.query(`SELECT COALESCE(SUM(total_cost),0) AS rev FROM ag_jobs WHERE status='completed' AND DATE_TRUNC('month',completed_date)=DATE_TRUNC('month',CURRENT_DATE)`),
      ]);
      return Response.json({
        total_clients: Number(totalClients.rows[0].n),
        active_field_contracts: Number(activeFields.rows[0].n),
        acres_under_management: Number(acresMgmt.rows[0].acres),
        crop_insurance_filed_ytd: Number(cropInsurance.rows[0].n),
        equipment_scheduled_this_week: Number(eqWeek.rows[0].n),
        revenue_mtd: Number(revMtd.rows[0].rev),
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('farm-agricultural GET error:', err);
    return Response.json({ error: 'Failed to fetch dashboard.' }, { status: 500 });
  }
}
