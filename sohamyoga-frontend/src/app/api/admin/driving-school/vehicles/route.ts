import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ds_vehicles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INT,
        license_plate TEXT,
        dual_controls BOOLEAN DEFAULT true,
        vehicle_type TEXT,
        insurance_expiry DATE,
        registration_expiry DATE,
        condition TEXT DEFAULT 'good',
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(
      `SELECT *,
              CASE WHEN insurance_expiry IS NOT NULL THEN insurance_expiry - CURRENT_DATE ELSE NULL END AS days_until_insurance_expiry,
              CASE WHEN registration_expiry IS NOT NULL THEN registration_expiry - CURRENT_DATE ELSE NULL END AS days_until_registration_expiry
       FROM ds_vehicles ORDER BY status, make, model`,
    );

    return Response.json({ vehicles: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { make, model, year, license_plate, dual_controls, vehicle_type, insurance_expiry, registration_expiry, condition, notes } = body;

  if (!make || !model) return Response.json({ error: 'make and model are required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ds_vehicles (make, model, year, license_plate, dual_controls, vehicle_type, insurance_expiry, registration_expiry, condition, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [make, model, year || null, license_plate || null, dual_controls !== false, vehicle_type || null, insurance_expiry || null, registration_expiry || null, condition || 'good', notes || null],
    );
    return Response.json({ vehicle: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
