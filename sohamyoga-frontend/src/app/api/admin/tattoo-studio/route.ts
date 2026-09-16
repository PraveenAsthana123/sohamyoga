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
      CREATE TABLE IF NOT EXISTS ts_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, date_of_birth DATE NOT NULL,
        id_verified BOOLEAN DEFAULT false, id_type TEXT, id_number TEXT,
        health_conditions TEXT[], medications TEXT[], allergies TEXT[],
        skin_type TEXT, keloid_prone BOOLEAN DEFAULT false,
        bloodborne_pathogen_consent BOOLEAN DEFAULT false, consent_date DATE,
        preferred_artist TEXT, referral_source TEXT,
        total_sessions INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ts_artist (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        stage_name TEXT, email TEXT, phone TEXT,
        specialties TEXT[], styles TEXT[],
        bloodborne_pathogen_cert_date DATE, bpp_expiry DATE,
        alberta_health_permit BOOLEAN DEFAULT true,
        booth_rent DECIMAL(10,2), commission_pct DECIMAL(5,2),
        instagram_handle TEXT, portfolio_url TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','guest','on_leave')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ts_appointment (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES ts_client(id),
        artist TEXT NOT NULL, appointment_type TEXT NOT NULL
          CHECK (appointment_type IN ('new_tattoo','touch_up','cover_up','piercing','consultation','removal_referral')),
        scheduled_at TIMESTAMPTZ NOT NULL, duration_hours DECIMAL(4,2) DEFAULT 2,
        deposit_amount DECIMAL(10,2) DEFAULT 100, deposit_paid BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'consultation_pending'
          CHECK (status IN ('consultation_pending','design_approved','booked','confirmed','in_progress','completed','cancelled','no_show')),
        placement TEXT, size_inches DECIMAL(5,2), style TEXT
          CHECK (style IN ('traditional','neo_traditional','realism','blackwork','geometric','watercolor','japanese','tribal','minimalist','lettering','portrait','other')),
        colors TEXT DEFAULT 'black_grey' CHECK (colors IN ('black_grey','full_color','single_color')),
        reference_image_url TEXT, design_notes TEXT,
        total_amount DECIMAL(10,2), balance_due DECIMAL(10,2),
        aftercare_instructions_given BOOLEAN DEFAULT false,
        healed_photo_requested BOOLEAN DEFAULT true,
        client_rating INTEGER CHECK (client_rating BETWEEN 1 AND 5),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ts_supply (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT
          CHECK (category IN ('ink','needle','aftercare','glove','barrier_film','machine_part','cleaning','piercing_jewelry','other')),
        brand TEXT, quantity_on_hand DECIMAL(10,2), unit TEXT DEFAULT 'unit',
        reorder_point DECIMAL(10,2) DEFAULT 10, cost_per_unit DECIMAL(10,2),
        supplier TEXT, is_sterile_single_use BOOLEAN DEFAULT false,
        expiry_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
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

    const [apptToday, revenueToday, depositsMtd, lowStock, artists] = await Promise.all([
      client.query(`SELECT COUNT(*) as count FROM ts_appointment WHERE DATE(scheduled_at) = $1 AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT SUM(total_amount) as total FROM ts_appointment WHERE DATE(scheduled_at) = $1 AND status = 'completed'`, [today]),
      client.query(`SELECT SUM(deposit_amount) as total FROM ts_appointment WHERE deposit_paid = true AND DATE(created_at) >= date_trunc('month', CURRENT_DATE)`),
      client.query(`SELECT COUNT(*) as count FROM ts_supply WHERE quantity_on_hand <= reorder_point`),
      client.query(`SELECT COUNT(*) as count FROM ts_artist WHERE status = 'active'`),
    ]);

    return NextResponse.json({
      appointments_today: Number(apptToday.rows[0].count),
      revenue_today: Number(revenueToday.rows[0].total ?? 0),
      deposits_collected_mtd: Number(depositsMtd.rows[0].total ?? 0),
      supplies_low_stock: Number(lowStock.rows[0].count),
      artists_active: Number(artists.rows[0].count),
    });
  } finally {
    client.release();
  }
}
