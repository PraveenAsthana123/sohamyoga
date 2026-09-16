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
    const db = await pool.connect();
    try {
      const [locations, staff] = await Promise.all([
        db.query(`
          SELECT id, name, city, manager_name,
            liquor_license, liquor_license_expiry,
            health_inspection_date, health_inspection_score,
            (liquor_license_expiry < NOW() + INTERVAL '60 days') AS liquor_alert,
            (health_inspection_date < NOW() - INTERVAL '6 months') AS inspection_due
          FROM rh_location WHERE status != 'closed'
          ORDER BY liquor_license_expiry NULLS LAST
        `),
        db.query(`
          SELECT s.id, s.name, s.role, s.location_id, l.name AS location_name,
            s.food_safe_expiry, s.serving_it_right_expiry,
            (s.food_safe_expiry < NOW() + INTERVAL '60 days') AS food_safe_alert,
            (s.serving_it_right_expiry < NOW() + INTERVAL '60 days') AS sir_alert
          FROM rh_staff s LEFT JOIN rh_location l ON l.id = s.location_id
          WHERE s.status = 'active'
            AND (s.food_safe_expiry < NOW() + INTERVAL '60 days' OR s.serving_it_right_expiry < NOW() + INTERVAL '60 days')
          ORDER BY LEAST(s.food_safe_expiry, s.serving_it_right_expiry)
        `),
      ]);
      return Response.json({ locations: locations.rows, staff: staff.rows });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
