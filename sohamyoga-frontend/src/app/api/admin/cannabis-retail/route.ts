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
      CREATE TABLE IF NOT EXISTS cr_product (
        id SERIAL PRIMARY KEY, brand TEXT NOT NULL, product_name TEXT NOT NULL,
        sku TEXT UNIQUE NOT NULL, upc TEXT UNIQUE,
        category TEXT NOT NULL CHECK (category IN ('flower','pre_roll','edible','beverage','concentrate','vape','capsule','topical','accessory','other')),
        subcategory TEXT, thc_pct DECIMAL(5,2), cbd_pct DECIMAL(5,2),
        weight_grams DECIMAL(8,2), unit_count INTEGER,
        province_sku TEXT,
        cost_price DECIMAL(10,2), retail_price DECIMAL(10,2),
        stock_quantity INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 5,
        storage_location TEXT,
        compliance_status TEXT DEFAULT 'approved' CHECK (compliance_status IN ('approved','recalled','restricted','discontinued')),
        is_active BOOLEAN DEFAULT true, age_restricted BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cr_sale (
        id SERIAL PRIMARY KEY,
        sale_date TIMESTAMPTZ DEFAULT NOW(),
        staff_id TEXT NOT NULL,
        customer_age_verified BOOLEAN NOT NULL DEFAULT false,
        customer_dob_confirmed DATE,
        subtotal DECIMAL(10,2) NOT NULL, gst_amount DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','debit','credit')),
        total_thc_grams DECIMAL(8,2),
        pos_reference TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cr_sale_item (
        id SERIAL PRIMARY KEY, sale_id INTEGER REFERENCES cr_sale(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES cr_product(id),
        quantity INTEGER NOT NULL, unit_price DECIMAL(10,2) NOT NULL,
        thc_grams_this_item DECIMAL(8,2),
        line_total DECIMAL(10,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cr_compliance_log (
        id SERIAL PRIMARY KEY, log_type TEXT NOT NULL
          CHECK (log_type IN ('age_check_fail','daily_limit_check','product_recall','staff_training','aglc_inspection','inventory_count','waste_disposal','suspicious_activity')),
        staff_involved TEXT, customer_info TEXT,
        description TEXT NOT NULL, action_taken TEXT,
        aglc_report_required BOOLEAN DEFAULT false, aglc_reported BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM cr_product`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO cr_product (brand, product_name, sku, upc, category, thc_pct, cbd_pct, weight_grams, province_sku, cost_price, retail_price, stock_quantity, reorder_point, storage_location)
        VALUES
          ('Spinach', 'FEELZ Tropical Mimosa', 'SPN-FL-001', '622936550018', 'flower', 20.5, 0.1, 3.5, 'AGLC-622936550018', 8.50, 13.99, 48, 10, 'Vault A'),
          ('Redecan', 'Redees Pink Kush Pre-Roll', 'RDC-PR-001', '627987000081', 'pre_roll', 22.0, 0.1, 0.5, 'AGLC-627987000081', 3.20, 5.99, 120, 20, 'Counter Display'),
          ('Bhang', 'Dark Chocolate Bar', 'BHG-ED-001', '853416003012', 'edible', 1.0, 0.0, 40.0, 'AGLC-853416003012', 6.50, 11.99, 36, 8, 'Edibles Fridge'),
          ('Hexo', 'Baked Edibles Peanut Butter Cookie', 'HXO-ED-001', '629211000072', 'edible', 0.5, 0.0, 48.0, 'AGLC-629211000072', 5.00, 9.99, 24, 6, 'Edibles Fridge'),
          ('Koios', 'Koios Sparkling Beverage Lemon', 'KIO-BV-001', '842234101068', 'beverage', 2.5, 0.0, 355.0, 'AGLC-842234101068', 5.00, 8.99, 60, 12, 'Beverage Cooler'),
          ('Indiva', 'Wappa Flower', 'IND-FL-001', '628347120011', 'flower', 18.0, 0.3, 7.0, 'AGLC-628347120011', 16.00, 26.99, 30, 8, 'Vault A'),
          ('Vape Kit', 'Air Bar Max Disposable', 'VAP-VV-001', NULL, 'vape', 85.0, 0.5, NULL, NULL, 15.00, 29.99, 18, 5, 'Vape Case'),
          ('Stash House', '1:1 CBD:THC Tincture', 'STH-CP-001', NULL, 'capsule', 5.0, 5.0, NULL, NULL, 20.00, 39.99, 12, 4, 'Capsule Shelf')
      `);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const today = new Date().toISOString().slice(0,10);
      const [salesRes, itemsRes, compRes, lowRes, recallRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS rev FROM cr_sale WHERE DATE(sale_date)=$1`, [today]),
        client.query(`SELECT COALESCE(SUM(quantity),0) AS items FROM cr_sale_item si JOIN cr_sale s ON s.id=si.sale_id WHERE DATE(s.sale_date)=$1`, [today]),
        client.query(`SELECT COUNT(*) AS cnt FROM cr_compliance_log WHERE DATE(created_at) >= DATE_TRUNC('month',CURRENT_DATE)`),
        client.query(`SELECT COUNT(*) AS cnt FROM cr_product WHERE stock_quantity <= reorder_point AND is_active=true AND compliance_status='approved'`),
        client.query(`SELECT * FROM cr_product WHERE compliance_status='recalled' AND is_active=true`),
      ]);
      return Response.json({
        sales_today: parseInt(salesRes.rows[0].cnt),
        revenue_today: parseFloat(salesRes.rows[0].rev),
        items_sold_today: parseInt(itemsRes.rows[0].items),
        compliance_events_mtd: parseInt(compRes.rows[0].cnt),
        low_stock_count: parseInt(lowRes.rows[0].cnt),
        product_recalls_active: recallRes.rows,
      });
    } finally { client.release(); }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
