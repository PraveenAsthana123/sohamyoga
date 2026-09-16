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
      const [vehicles, drivers] = await Promise.all([
        client.query(`
          SELECT id, unit_number, type, license_plate, province,
            insurance_expiry, registration_expiry, safety_cert_expiry,
            LEAST(insurance_expiry, registration_expiry, safety_cert_expiry) AS soonest_expiry,
            (insurance_expiry < NOW() + INTERVAL '60 days') AS insurance_alert,
            (registration_expiry < NOW() + INTERVAL '60 days') AS registration_alert,
            (safety_cert_expiry < NOW() + INTERVAL '60 days') AS safety_alert
          FROM tl_vehicle
          WHERE status != 'sold'
            AND (insurance_expiry < NOW() + INTERVAL '60 days' OR registration_expiry < NOW() + INTERVAL '60 days' OR safety_cert_expiry < NOW() + INTERVAL '60 days')
          ORDER BY soonest_expiry
        `),
        client.query(`
          SELECT id, name, license_class, license_expiry, medical_expiry, abstract_date, employment_type,
            (license_expiry < NOW() + INTERVAL '60 days') AS license_alert,
            (medical_expiry < NOW() + INTERVAL '60 days') AS medical_alert
          FROM tl_driver
          WHERE status = 'active'
            AND (license_expiry < NOW() + INTERVAL '60 days' OR medical_expiry < NOW() + INTERVAL '60 days')
          ORDER BY LEAST(license_expiry, medical_expiry)
        `),
      ]);
      return Response.json({ vehicles: vehicles.rows, drivers: drivers.rows });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
