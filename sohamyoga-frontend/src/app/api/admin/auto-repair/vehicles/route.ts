import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const customer_id = searchParams.get('customer_id');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT v.*, c.first_name, c.last_name, c.phone
      FROM ar_vehicle v
      LEFT JOIN ar_customer c ON c.id = v.customer_id
      WHERE ($1::int IS NULL OR v.customer_id = $1::int)
      ORDER BY v.created_at DESC
    `, [customer_id || null]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { customer_id, year, make, model, trim, color, vin, license_plate, province, engine, transmission, odometer_km, fuel_type, insurance_expiry, registration_expiry, notes } = body;
  if (!customer_id || !year || !make || !model) return Response.json({ error: 'customer_id, year, make, model required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO ar_vehicle (customer_id, year, make, model, trim, color, vin, license_plate, province, engine, transmission, odometer_km, fuel_type, insurance_expiry, registration_expiry, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [customer_id, year, make, model, trim||null, color||null, vin||null, license_plate||null, province||'AB', engine||null, transmission||'automatic', odometer_km||null, fuel_type||'gasoline', insurance_expiry||null, registration_expiry||null, notes||null]);
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
