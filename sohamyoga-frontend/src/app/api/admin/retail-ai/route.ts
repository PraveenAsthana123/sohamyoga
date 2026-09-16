import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS retail_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT UNIQUE,
  price NUMERIC(10,2),
  cost NUMERIC(10,2),
  stock_qty INT DEFAULT 0,
  sold_30d INT DEFAULT 0,
  sold_90d INT DEFAULT 0,
  revenue_30d NUMERIC(12,2) DEFAULT 0,
  return_rate NUMERIC(5,4) DEFAULT 0,
  avg_rating NUMERIC(3,2),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_type TEXT NOT NULL,
  product_id UUID REFERENCES retail_products(id),
  title TEXT NOT NULL,
  description TEXT,
  expected_lift_pct NUMERIC(5,2),
  confidence NUMERIC(5,4),
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  ai_source TEXT DEFAULT 'ollama',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_demand_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES retail_products(id),
  forecast_date DATE NOT NULL,
  predicted_units INT,
  actual_units INT,
  confidence_interval_low INT,
  confidence_interval_high INT,
  model_used TEXT DEFAULT 'moving_average',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES retail_products(id),
  old_price NUMERIC(10,2),
  new_price NUMERIC(10,2),
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const SEED_SQL = `
INSERT INTO retail_products (name, category, sku, price, cost, stock_qty, sold_30d, sold_90d, revenue_30d, return_rate, avg_rating, tags)
VALUES
  ('Premium Yoga Mat 6mm', 'Equipment', 'YM-001', 89.99, 22.00, 145, 87, 234, 7829.13, 0.04, 4.7, ARRAY['mat','equipment','bestseller']),
  ('Organic Ashwagandha Supplement 60ct', 'Supplements', 'SUP-002', 34.99, 8.50, 52, 143, 398, 5003.57, 0.06, 4.5, ARRAY['supplement','wellness','organic']),
  ('Bamboo Yoga Leggings', 'Clothing', 'CLO-003', 68.00, 18.00, 89, 61, 172, 4148.00, 0.11, 4.3, ARRAY['clothing','sustainable','leggings']),
  ('30-Day Beginner Yoga Course', 'Digital Courses', 'DC-004', 49.00, 0.00, 999, 112, 287, 5488.00, 0.02, 4.8, ARRAY['course','digital','beginner']),
  ('Cork Yoga Block Set (2pc)', 'Equipment', 'YM-005', 28.99, 7.00, 203, 45, 121, 1304.55, 0.03, 4.6, ARRAY['block','equipment','cork']),
  ('Whey Protein Blend - Vanilla 2lb', 'Supplements', 'SUP-006', 54.99, 14.00, 31, 8, 19, 439.92, 0.09, 3.8, ARRAY['supplement','protein','nutrition']),
  ('Meditation Cushion Round Zafu', 'Equipment', 'YM-007', 45.00, 11.00, 67, 29, 82, 1305.00, 0.05, 4.4, ARRAY['meditation','cushion','equipment']),
  ('Advanced Flow Yoga Course', 'Digital Courses', 'DC-008', 79.00, 0.00, 999, 0, 14, 0.00, 0.00, 4.1, ARRAY['course','digital','advanced']),
  ('Microfiber Yoga Towel Anti-slip', 'Equipment', 'YM-009', 24.99, 6.00, 178, 93, 261, 2324.07, 0.02, 4.5, ARRAY['towel','equipment','microfiber']),
  ('Turmeric Curcumin Capsules 90ct', 'Supplements', 'SUP-010', 29.99, 7.50, 6, 34, 89, 1019.66, 0.07, 4.2, ARRAY['supplement','turmeric','anti-inflammatory'])
ON CONFLICT (sku) DO NOTHING;

INSERT INTO retail_ai_recommendations (recommendation_type, product_id, title, description, expected_lift_pct, confidence, priority, status, ai_source)
SELECT 'reorder_alert', id, 'Reorder Now — Critical Stock Level',
  'Turmeric Curcumin has only 6 units remaining but sold 34 units last month. At current velocity you will stock out in 5 days. Place reorder immediately.',
  18.50, 0.9200, 'high', 'pending', 'rule_based'
FROM retail_products WHERE sku = 'SUP-010'
ON CONFLICT DO NOTHING;

INSERT INTO retail_ai_recommendations (recommendation_type, product_id, title, description, expected_lift_pct, confidence, priority, status, ai_source)
SELECT 'promote', id, 'Scale Ad Spend — Top Performer',
  '30-Day Beginner Course has a 4.8 rating and sold 112 units last month. Increasing Google/Meta spend by 30% is projected to drive an additional 34 enrollments this month.',
  22.30, 0.8800, 'high', 'pending', 'ollama'
FROM retail_products WHERE sku = 'DC-004'
ON CONFLICT DO NOTHING;

INSERT INTO retail_ai_recommendations (recommendation_type, product_id, title, description, expected_lift_pct, confidence, priority, status, ai_source)
SELECT 'product_bundle', id, 'Bundle with Yoga Mat — Cross-Sell Opportunity',
  'Customers who buy Yoga Leggings also browse mats 67% of the time. Create a bundle SKU at 10% combined discount to lift AOV by ~$25.',
  14.70, 0.7600, 'medium', 'pending', 'ollama'
FROM retail_products WHERE sku = 'CLO-003'
ON CONFLICT DO NOTHING;

INSERT INTO retail_ai_recommendations (recommendation_type, product_id, title, description, expected_lift_pct, confidence, priority, status, ai_source)
SELECT 'review_quality', id, 'High Return Rate — Quality Review Needed',
  'Whey Protein has 9% return rate vs category average of 4%. Top complaints: taste/mixability. Consider reformulation or switching supplier before next restock.',
  -8.00, 0.8100, 'medium', 'pending', 'rule_based'
FROM retail_products WHERE sku = 'SUP-006'
ON CONFLICT DO NOTHING;

INSERT INTO retail_ai_recommendations (recommendation_type, product_id, title, description, expected_lift_pct, confidence, priority, status, ai_source)
SELECT 'discontinue', id, 'No Sales in 30 Days — Consider Discontinuing',
  'Advanced Flow Course has had zero sales this month despite 14 sales in 90-day window. Review marketing funnel; if no recovery in 15 days, consider sunsetting or repackaging.',
  0.00, 0.6500, 'medium', 'pending', 'rule_based'
FROM retail_products WHERE sku = 'DC-008'
ON CONFLICT DO NOTHING;

INSERT INTO retail_ai_recommendations (recommendation_type, product_id, title, description, expected_lift_pct, confidence, priority, status, ai_source)
SELECT 'price_change', id, 'Competitive Price Opportunity',
  'Premium Yoga Mat has excellent 4.7 rating and high velocity. Competitor analysis suggests your price is 12% below market median. A modest 8% price increase tests at minimal volume loss.',
  9.20, 0.7200, 'low', 'pending', 'ollama'
FROM retail_products WHERE sku = 'YM-001'
ON CONFLICT DO NOTHING;
`;

async function seedDemandForecasts(pool: ReturnType<typeof getPool>): Promise<void> {
  const products = await pool.query<{ id: string; sold_30d: number }>(
    `SELECT id, sold_30d FROM retail_products ORDER BY sold_30d DESC LIMIT 3`,
  );
  for (const product of products.rows) {
    const dailyAvg = (product.sold_30d ?? 0) / 30;
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 7);
    for (let i = 0; i < 14; i++) {
      const forecastDate = new Date(baseDate);
      forecastDate.setDate(baseDate.getDate() + i);
      const trendFactor = 1 + (i * 0.005);
      const predicted = Math.max(1, Math.round(dailyAvg * trendFactor));
      const low = Math.max(0, Math.round(predicted * 0.8));
      const high = Math.round(predicted * 1.2);
      const actual = i < 7 ? Math.round(predicted * (0.85 + Math.random() * 0.3)) : null;
      await pool.query(
        `INSERT INTO retail_demand_forecast
           (product_id, forecast_date, predicted_units, actual_units, confidence_interval_low, confidence_interval_high, model_used)
         VALUES ($1, $2, $3, $4, $5, $6, 'moving_average')
         ON CONFLICT DO NOTHING`,
        [product.id, forecastDate.toISOString().split('T')[0], predicted, actual, low, high],
      );
    }
  }
}

async function seedPriceHistory(pool: ReturnType<typeof getPool>): Promise<void> {
  const entries = [
    { sku: 'YM-001', old_price: 79.99, new_price: 89.99, reason: 'Cost increase — raw materials +15%' },
    { sku: 'SUP-002', old_price: 39.99, new_price: 34.99, reason: 'Promotional price to clear Q2 excess inventory' },
    { sku: 'CLO-003', old_price: 62.00, new_price: 68.00, reason: 'Aligned to new sustainable materials cost basis' },
    { sku: 'DC-004', old_price: 59.00, new_price: 49.00, reason: 'Competitive repositioning vs Udemy/Coursera' },
  ];
  for (const e of entries) {
    const prod = await pool.query<{ id: string }>(`SELECT id FROM retail_products WHERE sku = $1`, [e.sku]);
    if (prod.rows[0]) {
      await pool.query(
        `INSERT INTO retail_price_history (product_id, old_price, new_price, reason) VALUES ($1, $2, $3, $4)`,
        [prod.rows[0].id, e.old_price, e.new_price, e.reason],
      );
    }
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO retail_products (name, category, sku, price, cost, stock_qty, avg_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        name,
        typeof body.category === 'string' ? body.category : null,
        typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : null,
        body.price ? parseFloat(String(body.price)) : null,
        body.cost ? parseFloat(String(body.cost)) : null,
        body.stock_qty ? parseInt(String(body.stock_qty), 10) : 0,
        body.avg_rating ? parseFloat(String(body.avg_rating)) : null,
      ],
    );
    return Response.json({ id: result.rows[0].id, success: true }, { status: 201 });
  } catch (err) {
    return Response.json({ error: 'Insert failed', detail: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const id = searchParams.get('id');

  if (!id || !action) {
    return Response.json({ error: 'action and id query params are required' }, { status: 400 });
  }

  if (!['apply', 'dismiss'].includes(action)) {
    return Response.json({ error: 'action must be "apply" or "dismiss"' }, { status: 400 });
  }

  const newStatus = action === 'apply' ? 'applied' : 'dismissed';

  try {
    const result = await pool.query(
      `UPDATE retail_ai_recommendations SET status = $1 WHERE id = $2 RETURNING id`,
      [newStatus, id],
    );
    if (!result.rowCount) return Response.json({ error: 'Recommendation not found' }, { status: 404 });
    return Response.json({ success: true, status: newStatus });
  } catch (err) {
    return Response.json({ error: 'Update failed', detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();

  try {
    await pool.query(SCHEMA_SQL);
  } catch (err) {
    return Response.json({ error: 'Schema migration failed', detail: String(err) }, { status: 500 });
  }

  // Seed if empty
  try {
    const existing = await pool.query('SELECT COUNT(*) AS cnt FROM retail_products');
    if (Number(existing.rows[0]?.cnt) === 0) {
      await pool.query(SEED_SQL);
      await seedDemandForecasts(pool);
      await seedPriceHistory(pool);
    }
  } catch (err) {
    // Non-fatal — seed may have partial conflicts
    console.error('[retail-ai] seed error:', err);
  }

  try {
    const [products, recommendations, forecasts, segSummary, priceSummary] = await Promise.all([
      pool.query<{
        id: string; name: string; category: string | null; sku: string | null; price: string | null;
        cost: string | null; stock_qty: number; sold_30d: number; sold_90d: number;
        revenue_30d: string | null; return_rate: string | null; avg_rating: string | null;
        tags: string[] | null; created_at: string;
      }>(`SELECT * FROM retail_products ORDER BY revenue_30d DESC NULLS LAST`),

      pool.query<{
        id: string; recommendation_type: string; product_id: string | null;
        title: string; description: string | null; expected_lift_pct: string | null;
        confidence: string | null; priority: string; status: string;
        ai_source: string; created_at: string; product_name: string | null;
      }>(`SELECT r.*, p.name AS product_name
          FROM retail_ai_recommendations r
          LEFT JOIN retail_products p ON p.id = r.product_id
          ORDER BY
            CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            r.created_at DESC`),

      pool.query<{
        id: string; product_id: string; forecast_date: string; predicted_units: number | null;
        actual_units: number | null; confidence_interval_low: number | null;
        confidence_interval_high: number | null; model_used: string; created_at: string;
        product_name: string | null;
      }>(`SELECT f.*, p.name AS product_name
          FROM retail_demand_forecast f
          LEFT JOIN retail_products p ON p.id = f.product_id
          ORDER BY f.forecast_date DESC
          LIMIT 60`),

      pool.query<{ total: string; pending: string; high: string; avg_rating: string; low_stock: string; revenue_30d: string }>(
        `SELECT
           COUNT(*)::text AS total,
           (SELECT COUNT(*)::text FROM retail_ai_recommendations WHERE status = 'pending') AS pending,
           (SELECT COUNT(*)::text FROM retail_ai_recommendations WHERE priority = 'high' AND status = 'pending') AS high,
           COALESCE(ROUND(AVG(avg_rating), 2)::text, '0') AS avg_rating,
           COUNT(*) FILTER (WHERE stock_qty < 20)::text AS low_stock,
           COALESCE(SUM(revenue_30d)::text, '0') AS revenue_30d
         FROM retail_products`,
      ),

      pool.query<{ id: string; product_id: string; old_price: string; new_price: string; reason: string; changed_at: string; product_name: string | null }>(
        `SELECT ph.*, p.name AS product_name
         FROM retail_price_history ph
         LEFT JOIN retail_products p ON p.id = ph.product_id
         ORDER BY ph.changed_at DESC
         LIMIT 20`,
      ),
    ]);

    const s = segSummary.rows[0];

    return Response.json({
      summary: {
        totalSkus: Number(s?.total ?? 0),
        pendingRecommendations: Number(s?.pending ?? 0),
        highPriorityRecommendations: Number(s?.high ?? 0),
        avgRating: Number(s?.avg_rating ?? 0),
        lowStockAlerts: Number(s?.low_stock ?? 0),
        revenue30d: Number(s?.revenue_30d ?? 0),
      },
      products: products.rows,
      recommendations: recommendations.rows,
      forecasts: forecasts.rows,
      priceHistory: priceSummary.rows,
    });
  } catch (err) {
    return Response.json({ error: 'Query failed', detail: String(err) }, { status: 500 });
  }
}
