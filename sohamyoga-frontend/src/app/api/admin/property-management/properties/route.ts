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
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const type = searchParams.get('property_type');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (status) { vals.push(status); conditions.push(`p.status=$${vals.length}`); }
      if (type) { vals.push(type); conditions.push(`p.property_type=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT p.*, COUNT(t.id) FILTER (WHERE t.status='active') AS active_tenants
        FROM pm_property p
        LEFT JOIN pm_tenant t ON t.property_id=p.id
        ${where}
        GROUP BY p.id ORDER BY p.created_at DESC
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { address, city = 'Calgary', province = 'AB', postal_code, property_type = 'residential', units_count = 1, owner_name, owner_email, owner_phone, monthly_rent, purchase_price, year_built, square_feet, status = 'occupied' } = body;
    if (!address) return Response.json({ error: 'address is required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO pm_property (address, city, province, postal_code, property_type, units_count, owner_name, owner_email, owner_phone, monthly_rent, purchase_price, year_built, square_feet, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
      `, [address, city, province, postal_code, property_type, units_count, owner_name, owner_email, owner_phone, monthly_rent || null, purchase_price || null, year_built || null, square_feet || null, status]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
