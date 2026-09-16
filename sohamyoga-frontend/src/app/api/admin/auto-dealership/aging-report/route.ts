import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT *,
          (CURRENT_DATE - date_added)::INT AS days_in_inventory,
          CASE
            WHEN (CURRENT_DATE - date_added) > 120 THEN ROUND(asking_price * 0.94, 0)
            WHEN (CURRENT_DATE - date_added) > 90  THEN ROUND(asking_price * 0.97, 0)
            WHEN (CURRENT_DATE - date_added) > 60  THEN ROUND(asking_price * 0.985, 0)
            ELSE asking_price
          END AS suggested_price,
          CASE
            WHEN (CURRENT_DATE - date_added) > 120 THEN 'Reduce $500+/week — wholesale risk'
            WHEN (CURRENT_DATE - date_added) > 90  THEN 'Price reduction recommended ($500)'
            WHEN (CURRENT_DATE - date_added) > 60  THEN 'Monitor — consider price adjustment'
            ELSE 'Healthy'
          END AS recommendation
        FROM auto_vehicle_inventory
        WHERE status = 'available' AND (CURRENT_DATE - date_added) > 60
        ORDER BY date_added ASC
      `);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
