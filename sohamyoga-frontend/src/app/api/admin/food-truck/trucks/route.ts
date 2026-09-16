import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const isActive = searchParams.get('is_active');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT *,
        LEAST(permit_expiry, business_license_expiry, fire_extinguisher_expiry, insurance_expiry) as next_expiry
       FROM ft_truck
       ${isActive !== null ? `WHERE is_active = ${isActive === 'true'}` : ''}
       ORDER BY truck_name`
    );
    return NextResponse.json({ trucks: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    truck_name, truck_number, cuisine_type, vehicle_type = 'truck',
    license_plate, vehicle_year, vehicle_make, vehicle_model, commissary_kitchen,
    alberta_health_permit_number, permit_expiry, calgary_business_license, business_license_expiry,
    fire_extinguisher_expiry, insurance_expiry, capacity_servings_per_hour = 60,
  } = body;

  if (!truck_name || !cuisine_type) {
    return NextResponse.json({ error: 'truck_name and cuisine_type required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ft_truck (truck_name, truck_number, cuisine_type, vehicle_type, license_plate,
        vehicle_year, vehicle_make, vehicle_model, commissary_kitchen,
        alberta_health_permit_number, permit_expiry, calgary_business_license, business_license_expiry,
        fire_extinguisher_expiry, insurance_expiry, capacity_servings_per_hour)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [truck_name, truck_number, cuisine_type, vehicle_type, license_plate,
        vehicle_year, vehicle_make, vehicle_model, commissary_kitchen,
        alberta_health_permit_number, permit_expiry, calgary_business_license, business_license_expiry,
        fire_extinguisher_expiry, insurance_expiry, capacity_servings_per_hour]
    );
    return NextResponse.json({ truck: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
