import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const location_id = searchParams.get('location_id');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = ['is_available = true', 'food_cost_pct IS NOT NULL'];
      const values: unknown[] = [];
      if (location_id) { values.push(location_id); conditions.push(`location_id = $${values.length}`); }
      const where = `WHERE ${conditions.join(' AND ')}`;
      const [items, categoryAvg] = await Promise.all([
        db.query(`SELECT * FROM rh_menu_item ${where} ORDER BY food_cost_pct DESC`, values),
        db.query(`SELECT category, ROUND(AVG(food_cost_pct),1) AS avg_pct, COUNT(*) AS n FROM rh_menu_item ${where} GROUP BY category ORDER BY avg_pct DESC`, values),
      ]);
      const target = { min: 28, max: 32 };
      return Response.json({
        items: items.rows,
        categoryAverages: categoryAvg.rows,
        targetRange: target,
        highCost: items.rows.filter((i: { food_cost_pct: number }) => i.food_cost_pct > 35),
        lowCost: items.rows.filter((i: { food_cost_pct: number }) => i.food_cost_pct < 20),
        onTarget: items.rows.filter((i: { food_cost_pct: number }) => i.food_cost_pct >= 20 && i.food_cost_pct <= 35),
      });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
