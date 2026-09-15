// Commerce Product Intelligence — backlog item #27. Real aggregation
// over order_item joined to the real sales_order table (corrected after
// a live \d check -- "order" doesn't exist, and order_item's real FK is
// to sales_order, not the guessed name). sales_order has no tenant_id
// (confirmed live) -- same single-tenant pattern as referral_master/
// operation_run elsewhere in this session, unscoped and disclosed.
// Confirmed live: 0 real products and 0 real orders exist in this
// environment today -- the query is real and ready, but honestly
// returns nothing to rank yet, never fabricated sample data.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export interface ProductPerformance { productId: string; productName: string; unitsSold: number; revenue: number }

export async function getProductPerformance(): Promise<ProductPerformance[]> {
  const r = await db.query<{ product_id: string; product_name: string; units: string; revenue: string }>(
    `SELECT oi.product_id, oi.product_name, sum(oi.quantity)::text AS units,
            sum(oi.quantity * oi.unit_price - oi.discount_amount)::text AS revenue
     FROM order_item oi JOIN sales_order so ON so.id = oi.order_id
     GROUP BY oi.product_id, oi.product_name ORDER BY sum(oi.quantity * oi.unit_price) DESC`,
  );
  return r.rows.map((row) => ({ productId: row.product_id, productName: row.product_name, unitsSold: Number(row.units), revenue: Number(row.revenue) }));
}
