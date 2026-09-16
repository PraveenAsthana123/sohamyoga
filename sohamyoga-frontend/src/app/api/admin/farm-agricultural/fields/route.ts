import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const crop = searchParams.get('crop');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (client_id) { conditions.push(`f.client_id=$${vals.length + 1}`); vals.push(client_id); }
    if (crop) { conditions.push(`f.crop_this_year ILIKE $${vals.length + 1}`); vals.push(`%${crop}%`); }
    if (status === 'seeded') conditions.push(`f.seeding_date IS NOT NULL AND f.actual_yield_bu_ac IS NULL`);
    if (status === 'harvested') conditions.push(`f.actual_yield_bu_ac IS NOT NULL`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT f.*, c.farm_name, c.operator_name FROM ag_fields f
         JOIN ag_clients c ON c.id=f.client_id
         ${where} ORDER BY c.farm_name, f.field_name`, vals
      );
      return Response.json({ fields: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag fields GET error:', err);
    return Response.json({ error: 'Failed to fetch fields.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => null);
    if (!body?.client_id || !body?.field_name) return Response.json({ error: 'client_id and field_name are required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ag_fields (client_id, field_name, legal_description, acres, soil_zone, irrigation, crop_this_year, crop_last_year, seeding_date, expected_harvest_date, yield_estimate_bu_ac, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [body.client_id, body.field_name, body.legal_description, body.acres, body.soil_zone ?? 'black', body.irrigation ?? false, body.crop_this_year, body.crop_last_year, body.seeding_date, body.expected_harvest_date, body.yield_estimate_bu_ac, body.notes]
      );
      return Response.json({ field: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag fields POST error:', err);
    return Response.json({ error: 'Failed to create field.' }, { status: 500 });
  }
}
