import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (type) { values.push(type); conditions.push(`v.type = $${values.length}`); }
      if (status) { values.push(status); conditions.push(`v.status = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT v.*, d.name AS driver_name FROM tl_vehicle v LEFT JOIN tl_driver d ON d.id = v.current_driver_id ${where} ORDER BY v.unit_number`,
        values
      );
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO tl_vehicle (unit_number,type,make,model,year,vin,license_plate,province,gross_vehicle_weight_rating,status,fuel_type,insurance_expiry,registration_expiry,safety_cert_expiry,next_maintenance_km,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [body.unit_number,body.type,body.make,body.model,body.year||null,body.vin,body.license_plate,body.province||'AB',body.gross_vehicle_weight_rating||null,body.status||'active',body.fuel_type||'diesel',body.insurance_expiry||null,body.registration_expiry||null,body.safety_cert_expiry||null,body.next_maintenance_km||null,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
