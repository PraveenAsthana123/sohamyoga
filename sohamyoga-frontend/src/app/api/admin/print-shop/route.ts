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
      CREATE TABLE IF NOT EXISTS ps_customer (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, company TEXT,
        customer_type TEXT DEFAULT 'business' CHECK (customer_type IN ('business','individual','government','non_profit','trade')),
        billing_address TEXT, discount_pct DECIMAL(5,2) DEFAULT 0,
        account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active','credit_hold','inactive')),
        total_orders INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ps_order (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES ps_customer(id),
        order_number TEXT UNIQUE NOT NULL,
        product_type TEXT NOT NULL CHECK (product_type IN ('business_cards','flyers','brochures','posters','banners','vinyl_signs','vehicle_wrap','window_graphics','yard_signs','roll_up_banner','canvas_print','trade_show_display','stickers','labels','letterhead','envelopes','booklets','t_shirts','branded_merchandise','other')),
        quantity INTEGER NOT NULL, size TEXT, paper_stock TEXT,
        finish TEXT CHECK (finish IN ('matte','gloss','uv_coating','laminate','none')),
        sides TEXT DEFAULT 'single' CHECK (sides IN ('single','double')),
        color_mode TEXT DEFAULT 'full_color' CHECK (color_mode IN ('full_color','black_white','spot_color')),
        artwork_status TEXT DEFAULT 'awaiting' CHECK (artwork_status IN ('awaiting','received','approved','revision_needed','final')),
        proof_sent BOOLEAN DEFAULT false, proof_approved BOOLEAN DEFAULT false,
        rush_order BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'quote' CHECK (status IN ('quote','artwork_review','pre_press','printing','finishing','quality_check','ready_for_pickup','shipped','delivered','cancelled')),
        unit_price DECIMAL(10,2), total_price DECIMAL(10,2),
        setup_fee DECIMAL(10,2) DEFAULT 0, rush_fee DECIMAL(10,2) DEFAULT 0,
        deposit_paid DECIMAL(10,2) DEFAULT 0, balance_due DECIMAL(10,2),
        due_date DATE, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ps_material (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT
          CHECK (category IN ('paper','substrate','ink','vinyl','canvas','fabric','other')),
        stock_quantity DECIMAL(10,2), unit TEXT DEFAULT 'sheets',
        reorder_point DECIMAL(10,2) DEFAULT 100, cost_per_unit DECIMAL(10,2),
        supplier TEXT, sku TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ps_design_file (
        id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES ps_order(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL, file_url TEXT, file_type TEXT,
        version INTEGER DEFAULT 1, is_final BOOLEAN DEFAULT false,
        uploaded_at TIMESTAMPTZ DEFAULT NOW(), notes TEXT
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
    const [inProd, rush, revMtd, lowStock, readyPickup] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM ps_order WHERE status IN ('artwork_review','pre_press','printing','finishing','quality_check')`),
      client.query(`SELECT COUNT(*) AS n FROM ps_order WHERE rush_order = true AND status NOT IN ('delivered','cancelled')`),
      client.query(`SELECT COALESCE(SUM(total_price),0) AS total FROM ps_order WHERE date_trunc('month', created_at) = date_trunc('month', NOW()) AND status != 'cancelled'`),
      client.query(`SELECT COUNT(*) AS n FROM ps_material WHERE stock_quantity <= reorder_point`),
      client.query(`SELECT COUNT(*) AS n FROM ps_order WHERE status = 'ready_for_pickup'`),
    ]);
    const pipeline = await client.query(`
      SELECT o.*, c.first_name || ' ' || c.last_name AS customer_name, c.company
      FROM ps_order o LEFT JOIN ps_customer c ON c.id = o.customer_id
      WHERE o.status NOT IN ('delivered','cancelled')
      ORDER BY o.due_date NULLS LAST, o.rush_order DESC, o.created_at
    `);
    return NextResponse.json({
      orders_in_production: parseInt(inProd.rows[0].n),
      rush_orders_today: parseInt(rush.rows[0].n),
      revenue_mtd: parseFloat(revMtd.rows[0].total),
      materials_low_stock: parseInt(lowStock.rows[0].n),
      ready_for_pickup_count: parseInt(readyPickup.rows[0].n),
      pipeline: pipeline.rows,
    });
  } finally {
    client.release();
  }
}
