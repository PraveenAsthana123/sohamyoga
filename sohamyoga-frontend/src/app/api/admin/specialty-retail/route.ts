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
      CREATE TABLE IF NOT EXISTS sr_product (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, sku TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL, subcategory TEXT, brand TEXT, description TEXT,
        cost_price DECIMAL(10,2) NOT NULL, retail_price DECIMAL(10,2) NOT NULL,
        sale_price DECIMAL(10,2), is_on_sale BOOLEAN DEFAULT false,
        margin_pct DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN retail_price > 0 THEN (retail_price - cost_price) / retail_price * 100 ELSE 0 END) STORED,
        stock_quantity INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 5,
        location TEXT, barcode TEXT UNIQUE, tags TEXT[], images TEXT[],
        is_active BOOLEAN DEFAULT true, is_seasonal BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sr_customer (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT, birthday DATE,
        loyalty_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze'
          CHECK (loyalty_tier IN ('bronze','silver','gold','platinum')),
        total_purchases INTEGER DEFAULT 0, total_spent DECIMAL(12,2) DEFAULT 0,
        last_purchase_date DATE, preferred_categories TEXT[], notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sr_sale (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES sr_customer(id),
        sale_date TIMESTAMPTZ DEFAULT NOW(), subtotal DECIMAL(10,2) NOT NULL,
        discount_amount DECIMAL(10,2) DEFAULT 0, gst_amount DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL, loyalty_points_earned INTEGER DEFAULT 0,
        loyalty_points_redeemed INTEGER DEFAULT 0,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','credit','debit','etransfer','gift_card','loyalty_points','split')),
        staff_name TEXT, pos_reference TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sr_sale_item (
        id SERIAL PRIMARY KEY, sale_id INTEGER REFERENCES sr_sale(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES sr_product(id),
        quantity INTEGER NOT NULL, unit_price DECIMAL(10,2) NOT NULL,
        discount_pct DECIMAL(5,2) DEFAULT 0, line_total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const today = new Date().toISOString().split('T')[0];
      const [salesToday, lowStock, topProduct] = await Promise.all([
        client.query(`SELECT COALESCE(SUM(total_amount),0) AS revenue_today, COUNT(*) AS transaction_count, COALESCE(AVG(total_amount),0) AS avg_transaction FROM sr_sale WHERE DATE(sale_date)=$1`, [today]),
        client.query(`SELECT COUNT(*) AS low_stock_count FROM sr_product WHERE stock_quantity <= reorder_point AND is_active=true`),
        client.query(`SELECT p.name, SUM(si.line_total) AS revenue FROM sr_sale_item si JOIN sr_product p ON p.id=si.product_id JOIN sr_sale s ON s.id=si.sale_id WHERE DATE(s.sale_date)=$1 GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 1`, [today]),
      ]);
      return NextResponse.json({
        sales_today: parseFloat(salesToday.rows[0].revenue_today),
        revenue_today: parseFloat(salesToday.rows[0].revenue_today),
        avg_transaction_today: parseFloat(salesToday.rows[0].avg_transaction),
        transaction_count_today: parseInt(salesToday.rows[0].transaction_count),
        low_stock_count: parseInt(lowStock.rows[0].low_stock_count),
        top_product_today: topProduct.rows[0] || null,
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
