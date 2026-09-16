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
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (type) { conditions.push(`type=$${vals.length + 1}`); vals.push(type); }
    if (status === 'available') conditions.push(`is_available=true`);
    if (status === 'unavailable') conditions.push(`is_available=false`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM ag_equipment ${where} ORDER BY type, name`, vals);
      return Response.json({ equipment: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag equipment GET error:', err);
    return Response.json({ error: 'Failed to fetch equipment.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => null);
    if (!body?.name) return Response.json({ error: 'name is required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ag_equipment (name, type, make, model, year, serial_number, hours_meter, next_service_hours, next_service_date, condition, insurance_expiry, notes, is_available)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [body.name, body.type ?? 'tractor', body.make, body.model, body.year, body.serial_number, body.hours_meter, body.next_service_hours, body.next_service_date, body.condition ?? 'good', body.insurance_expiry, body.notes, body.is_available ?? true]
      );
      return Response.json({ equipment: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag equipment POST error:', err);
    return Response.json({ error: 'Failed to create equipment.' }, { status: 500 });
  }
}
