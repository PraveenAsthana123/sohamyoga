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
    const vehicle_id = searchParams.get('vehicle_id');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (vehicle_id) { values.push(vehicle_id); conditions.push(`m.vehicle_id = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT m.*, v.unit_number FROM tl_maintenance m LEFT JOIN tl_vehicle v ON v.id = m.vehicle_id ${where} ORDER BY m.maintenance_date DESC`,
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
        `INSERT INTO tl_maintenance (vehicle_id,maintenance_type,description,odometer_km,cost,vendor,work_order,maintenance_date,next_due_date,next_due_km,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.vehicle_id,body.maintenance_type,body.description,body.odometer_km||null,body.cost||null,body.vendor,body.work_order,body.maintenance_date||new Date().toISOString().slice(0,10),body.next_due_date||null,body.next_due_km||null,body.status||'completed']
      );
      // Update vehicle last_maintenance_date
      await client.query(`UPDATE tl_vehicle SET last_maintenance_date=$1 WHERE id=$2`, [body.maintenance_date||new Date().toISOString().slice(0,10), body.vehicle_id]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
