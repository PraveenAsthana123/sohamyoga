import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { product_id?: unknown; days_ahead?: unknown };
  try {
    body = await req.json() as { product_id?: unknown; days_ahead?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
  if (!productId) {
    return Response.json({ error: 'product_id is required' }, { status: 400 });
  }

  const daysAhead = Math.min(Math.max(Number(body.days_ahead) || 14, 1), 90);

  const pool = getPool();

  const productResult = await pool.query<{ id: string; name: string; sold_30d: number; sold_90d: number }>(
    `SELECT id, name, sold_30d, sold_90d FROM retail_products WHERE id = $1`,
    [productId],
  );

  if (!productResult.rows.length) {
    return Response.json({ error: 'Product not found' }, { status: 404 });
  }

  const product = productResult.rows[0];
  const dailyAvg30 = (product.sold_30d ?? 0) / 30;
  const dailyAvg90 = (product.sold_90d ?? 0) / 90;
  // Use weighted average of 30d and 90d for smoother estimate
  const dailyAvg = (dailyAvg30 * 0.7) + (dailyAvg90 * 0.3);

  // Delete existing future forecasts for this product to avoid duplicates
  await pool.query(
    `DELETE FROM retail_demand_forecast
     WHERE product_id = $1 AND forecast_date >= CURRENT_DATE`,
    [productId],
  );

  const rows = [];
  for (let i = 0; i < daysAhead; i++) {
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + i);
    const dateStr = forecastDate.toISOString().split('T')[0];

    // Slightly increasing trend: 0.5% per day
    const trendFactor = 1 + (i * 0.005);
    // Small cyclical factor: weekends +15%, weekdays baseline
    const dayOfWeek = forecastDate.getDay();
    const cyclical = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
    const predicted = Math.max(1, Math.round(dailyAvg * trendFactor * cyclical));
    const low = Math.max(0, Math.round(predicted * 0.8));
    const high = Math.round(predicted * 1.2);

    try {
      await pool.query(
        `INSERT INTO retail_demand_forecast
           (product_id, forecast_date, predicted_units, actual_units, confidence_interval_low, confidence_interval_high, model_used)
         VALUES ($1, $2, $3, NULL, $4, $5, 'moving_average')`,
        [productId, dateStr, predicted, low, high],
      );
      rows.push({
        date: dateStr,
        predicted_units: predicted,
        actual_units: null,
        confidence_interval_low: low,
        confidence_interval_high: high,
        model_used: 'moving_average',
        day_of_week: forecastDate.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    } catch (err) {
      console.error('[retail-ai/forecast] insert error for', dateStr, err);
    }
  }

  return Response.json({
    product_id: productId,
    product_name: product.name,
    daily_avg_30d: parseFloat(dailyAvg30.toFixed(2)),
    daily_avg_used: parseFloat(dailyAvg.toFixed(2)),
    days_ahead: daysAhead,
    model: 'moving_average',
    forecasts: rows,
  });
}
