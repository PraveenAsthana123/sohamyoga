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
      CREATE TABLE IF NOT EXISTS jw_inventory (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku TEXT,
        name TEXT NOT NULL,
        category TEXT,
        metal_type TEXT,
        metal_purity TEXT,
        gemstone_type TEXT,
        gemstone_cert_lab TEXT,
        cost_price NUMERIC,
        retail_price NUMERIC,
        appraisal_value NUMERIC,
        appraisal_date DATE,
        status TEXT DEFAULT 'in_stock',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jw_sales (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id uuid,
        customer_name TEXT,
        customer_phone TEXT,
        salesperson TEXT,
        sale_date DATE,
        retail_price NUMERIC,
        discount_amount NUMERIC DEFAULT 0,
        final_price NUMERIC,
        gst_amount NUMERIC,
        total_amount NUMERIC,
        payment_method TEXT,
        fintrac_reported BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jw_repairs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        item_description TEXT,
        issue_reported TEXT,
        estimated_cost NUMERIC,
        actual_cost NUMERIC,
        promised_date DATE,
        completed_date DATE,
        status TEXT DEFAULT 'received',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jw_custom_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT,
        design_description TEXT,
        metal_type TEXT,
        budget_range NUMERIC,
        deposit_amount NUMERIC,
        deposit_received BOOLEAN DEFAULT false,
        due_date DATE,
        status TEXT DEFAULT 'inquiry',
        total_quoted NUMERIC,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jw_consignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_name TEXT NOT NULL,
        seller_phone TEXT,
        item_description TEXT,
        asking_price NUMERIC,
        commission_pct NUMERIC DEFAULT 30,
        received_date DATE,
        expiry_date DATE,
        sold_price NUMERIC,
        status TEXT DEFAULT 'on_floor',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jw_fintrac_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_date DATE,
        customer_name TEXT,
        id_type TEXT,
        amount NUMERIC,
        transaction_type TEXT,
        submitted_date DATE,
        reference_number TEXT,
        notes TEXT,
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
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = today.slice(0, 7) + '-01';
    const [invValue, salesToday, repairs, customOrders, consignments, fintrac] = await Promise.all([
      client.query(`SELECT COALESCE(SUM(retail_price),0) AS total FROM jw_inventory WHERE status = 'in_stock'`),
      client.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM jw_sales WHERE sale_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM jw_repairs WHERE status NOT IN ('completed','returned')`),
      client.query(`SELECT COUNT(*) AS n FROM jw_custom_orders WHERE status NOT IN ('completed','cancelled')`),
      client.query(`SELECT COUNT(*) AS n FROM jw_consignments WHERE status = 'on_floor'`),
      client.query(`SELECT COUNT(*) AS n FROM jw_fintrac_reports WHERE transaction_date >= $1`, [firstOfMonth]),
    ]);
    return Response.json({
      total_inventory_value: parseFloat(invValue.rows[0].total),
      sales_today: parseFloat(salesToday.rows[0].total),
      repairs_in_progress: parseInt(repairs.rows[0].n, 10),
      custom_orders_active: parseInt(customOrders.rows[0].n, 10),
      consignments_on_floor: parseInt(consignments.rows[0].n, 10),
      fintrac_reports_this_month: parseInt(fintrac.rows[0].n, 10),
    });
  } finally {
    client.release();
  }
}
