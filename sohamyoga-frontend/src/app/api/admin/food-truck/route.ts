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
      CREATE TABLE IF NOT EXISTS ft_truck (
        id SERIAL PRIMARY KEY, truck_name TEXT NOT NULL, truck_number TEXT,
        cuisine_type TEXT NOT NULL CHECK (cuisine_type IN ('mexican','asian_fusion','bbq','pizza','burgers','indian','greek','thai','japanese','canadian','desserts','coffee','breakfast','vegan','other')),
        vehicle_type TEXT DEFAULT 'truck' CHECK (vehicle_type IN ('truck','trailer','cart','van','bus')),
        license_plate TEXT, vehicle_year INTEGER, vehicle_make TEXT, vehicle_model TEXT,
        commissary_kitchen TEXT,
        alberta_health_permit_number TEXT, permit_expiry DATE,
        calgary_business_license TEXT, business_license_expiry DATE,
        fire_extinguisher_expiry DATE, insurance_expiry DATE,
        capacity_servings_per_hour INTEGER DEFAULT 60,
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ft_event (
        id SERIAL PRIMARY KEY, truck_id INTEGER REFERENCES ft_truck(id),
        event_name TEXT NOT NULL, event_type TEXT DEFAULT 'street_vending'
          CHECK (event_type IN ('street_vending','festival','private_catering','corporate_lunch','farmers_market','food_truck_rally','wedding','birthday','other')),
        event_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
        location TEXT NOT NULL, location_permit_required BOOLEAN DEFAULT false,
        location_permit_obtained BOOLEAN DEFAULT false,
        expected_customers INTEGER, actual_customers INTEGER,
        gross_revenue DECIMAL(10,2), cogs DECIMAL(10,2),
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','rained_out')),
        weather_notes TEXT, menu_variant TEXT, staff_count INTEGER DEFAULT 2,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ft_menu_item (
        id SERIAL PRIMARY KEY, truck_id INTEGER REFERENCES ft_truck(id),
        name TEXT NOT NULL, description TEXT, category TEXT
          CHECK (category IN ('main','side','drink','dessert','combo','special')),
        price DECIMAL(10,2) NOT NULL, food_cost DECIMAL(10,2),
        food_cost_pct DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN price > 0 THEN food_cost / price * 100 ELSE 0 END) STORED,
        is_active BOOLEAN DEFAULT true, is_seasonal BOOLEAN DEFAULT false,
        dietary_tags TEXT[], allergens TEXT[],
        avg_servings_per_event INTEGER DEFAULT 30, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ft_expense (
        id SERIAL PRIMARY KEY, truck_id INTEGER REFERENCES ft_truck(id),
        event_id INTEGER REFERENCES ft_event(id),
        expense_date DATE DEFAULT CURRENT_DATE,
        category TEXT NOT NULL CHECK (category IN ('food_supplies','propane_fuel','vehicle_fuel','permits','commissary','staff_wages','maintenance','marketing','insurance','other')),
        description TEXT NOT NULL, amount DECIMAL(10,2) NOT NULL,
        vendor TEXT, receipt_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [eventsMtd, revenueMtd, bestEvent, avgFoodCost, permitsExpiring] = await Promise.all([
      client.query(`SELECT COUNT(*) as count FROM ft_event WHERE event_date >= $1`, [monthStart]),
      client.query(`SELECT SUM(gross_revenue) as total FROM ft_event WHERE event_date >= $1 AND status = 'completed'`, [monthStart]),
      client.query(`SELECT event_name, gross_revenue FROM ft_event WHERE status = 'completed' ORDER BY gross_revenue DESC LIMIT 1`),
      client.query(`SELECT ROUND(AVG(food_cost_pct), 1) as avg_pct FROM ft_menu_item WHERE is_active = true AND food_cost_pct > 0`),
      client.query(`SELECT COUNT(*) as count FROM ft_truck WHERE is_active = true AND (
        permit_expiry <= $1 OR business_license_expiry <= $1 OR
        fire_extinguisher_expiry <= $1 OR insurance_expiry <= $1
      )`, [in60Days]),
    ]);

    return NextResponse.json({
      events_this_month: Number(eventsMtd.rows[0].count),
      revenue_mtd: Number(revenueMtd.rows[0].total ?? 0),
      best_event: bestEvent.rows[0] ?? null,
      avg_food_cost_pct: Number(avgFoodCost.rows[0].avg_pct ?? 0),
      permits_expiring_60d: Number(permitsExpiring.rows[0].count),
    });
  } finally {
    client.release();
  }
}
