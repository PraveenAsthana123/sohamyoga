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
      const vals: unknown[] = [];
      let where = '';
      if (status) { vals.push(status); where = `WHERE t.status=$1`; }
      const { rows } = await client.query(`
        SELECT t.*, p.address, p.city,
          EXTRACT(DAY FROM (t.lease_end - NOW())) AS days_until_expiry
        FROM pm_tenant t
        LEFT JOIN pm_property p ON p.id = t.property_id
        ${where}
        ORDER BY t.created_at DESC
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
    const { property_id, first_name, last_name, email, phone, unit_number, lease_start, lease_end, monthly_rent, security_deposit, status = 'active', emergency_contact_name, emergency_contact_phone, notes } = body;
    if (!first_name || !last_name || !email || !lease_start || !monthly_rent) {
      return Response.json({ error: 'first_name, last_name, email, lease_start, monthly_rent required' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO pm_tenant (property_id, first_name, last_name, email, phone, unit_number, lease_start, lease_end, monthly_rent, security_deposit, status, emergency_contact_name, emergency_contact_phone, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
      `, [property_id || null, first_name, last_name, email, phone, unit_number, lease_start, lease_end || null, monthly_rent, security_deposit || null, status, emergency_contact_name, emergency_contact_phone, notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
