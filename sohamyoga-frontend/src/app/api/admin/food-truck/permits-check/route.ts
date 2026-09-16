import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, truck_name, cuisine_type,
        permit_expiry, business_license_expiry, fire_extinguisher_expiry, insurance_expiry,
        (permit_expiry - CURRENT_DATE) as permit_days,
        (business_license_expiry - CURRENT_DATE) as license_days,
        (fire_extinguisher_expiry - CURRENT_DATE) as fire_days,
        (insurance_expiry - CURRENT_DATE) as insurance_days
       FROM ft_truck
       WHERE is_active = true AND (
         permit_expiry <= $1 OR business_license_expiry <= $1 OR
         fire_extinguisher_expiry <= $1 OR insurance_expiry <= $1
       )
       ORDER BY LEAST(permit_expiry, business_license_expiry, fire_extinguisher_expiry, insurance_expiry)`,
      [in60Days]
    );
    return NextResponse.json({ trucks_with_expiries: rows, checked_until: in60Days });
  } finally {
    client.release();
  }
}
