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
        SELECT v.id, v.unit_number, v.type, v.odometer_km, v.next_maintenance_km, v.last_maintenance_date,
               v.insurance_expiry, v.registration_expiry, v.safety_cert_expiry,
               CASE WHEN v.next_maintenance_km IS NOT NULL AND v.odometer_km IS NOT NULL
                    THEN v.next_maintenance_km - v.odometer_km ELSE NULL END AS km_remaining
        FROM tl_vehicle v
        WHERE v.status != 'sold'
          AND (
            (v.next_maintenance_km IS NOT NULL AND v.odometer_km IS NOT NULL AND v.next_maintenance_km - v.odometer_km <= 5000)
            OR v.insurance_expiry < NOW() + INTERVAL '30 days'
            OR v.registration_expiry < NOW() + INTERVAL '30 days'
            OR v.safety_cert_expiry < NOW() + INTERVAL '30 days'
          )
        ORDER BY km_remaining NULLS LAST
      `);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
