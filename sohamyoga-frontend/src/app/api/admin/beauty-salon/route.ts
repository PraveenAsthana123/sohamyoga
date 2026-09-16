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
      CREATE TABLE IF NOT EXISTS salon_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, date_of_birth DATE,
        preferred_stylist TEXT, skin_type TEXT, hair_type TEXT,
        allergies TEXT, notes TEXT, loyalty_points INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0, visit_count INTEGER DEFAULT 0,
        last_visit DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS salon_service (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL
          CHECK (category IN ('hair','nails','skin','spa','makeup','waxing','lashes','other')),
        description TEXT, duration_minutes INTEGER NOT NULL DEFAULT 60,
        price DECIMAL(10,2) NOT NULL, stylist TEXT,
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS salon_appointment (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES salon_client(id),
        service_id INTEGER REFERENCES salon_service(id),
        stylist TEXT NOT NULL, appointment_at TIMESTAMPTZ NOT NULL,
        status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
        notes TEXT, total_amount DECIMAL(10,2), tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT CHECK (payment_method IN ('cash','credit','debit','etransfer','gift_card')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS salon_product (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, brand TEXT, category TEXT,
        sku TEXT UNIQUE, cost_price DECIMAL(10,2), retail_price DECIMAL(10,2),
        stock_quantity INTEGER DEFAULT 0, reorder_level INTEGER DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [apptTodayRes, revTodayRes, topStylistRes, lowStockRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS cnt FROM salon_appointment WHERE appointment_at::date = CURRENT_DATE AND status NOT IN ('cancelled','no_show')`),
        client.query(`SELECT COALESCE(SUM(total_amount),0) AS rev, COALESCE(SUM(tip_amount),0) AS tips FROM salon_appointment WHERE appointment_at::date = CURRENT_DATE AND status='completed'`),
        client.query(`SELECT stylist, COUNT(*) AS appointments, COALESCE(SUM(total_amount),0) AS revenue FROM salon_appointment WHERE appointment_at >= NOW()-INTERVAL '30 days' AND status='completed' GROUP BY stylist ORDER BY appointments DESC LIMIT 1`),
        client.query(`SELECT COUNT(*) AS cnt FROM salon_product WHERE stock_quantity <= reorder_level`),
      ]);
      return Response.json({
        appointments_today: Number(apptTodayRes.rows[0].cnt),
        revenue_today: Number(revTodayRes.rows[0].rev),
        tips_today: Number(revTodayRes.rows[0].tips),
        top_stylist: topStylistRes.rows[0] ?? null,
        low_stock_count: Number(lowStockRes.rows[0].cnt),
      });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
