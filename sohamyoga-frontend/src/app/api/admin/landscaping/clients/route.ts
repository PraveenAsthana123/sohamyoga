import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const property_type = searchParams.get('property_type');
    const status = searchParams.get('status');
    let q = `SELECT * FROM ls_client WHERE 1=1`;
    const vals: string[] = [];
    let idx = 1;
    if (property_type) { q += ` AND property_type = $${idx++}`; vals.push(property_type); }
    if (status) { q += ` AND status = $${idx++}`; vals.push(status); }
    q += ` ORDER BY last_name, first_name`;
    const { rows } = await client.query(q, vals);
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { rows } = await client.query(`
      INSERT INTO ls_client (first_name, last_name, email, phone, address, city, province, postal_code, property_type, lot_size_sqft, has_irrigation, fence_type, gate_code, dog_on_property, special_notes, services_subscribed, seasonal_contract_value, contract_type, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `, [
      body.first_name, body.last_name, body.email ?? null, body.phone, body.address,
      body.city ?? 'Calgary', body.province ?? 'AB', body.postal_code ?? null,
      body.property_type ?? 'residential', body.lot_size_sqft ?? null,
      body.has_irrigation ?? false, body.fence_type ?? null, body.gate_code ?? null,
      body.dog_on_property ?? false, body.special_notes ?? null,
      body.services_subscribed ?? ['lawn_care'], body.seasonal_contract_value ?? null,
      body.contract_type ?? 'seasonal', body.status ?? 'active',
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
