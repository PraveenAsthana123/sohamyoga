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
    const status = searchParams.get('status');
    const driver_id = searchParams.get('driver_id');
    const vehicle_id = searchParams.get('vehicle_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (status) { values.push(status); conditions.push(`l.status = $${values.length}`); }
      if (driver_id) { values.push(driver_id); conditions.push(`l.driver_id = $${values.length}`); }
      if (vehicle_id) { values.push(vehicle_id); conditions.push(`l.vehicle_id = $${values.length}`); }
      if (from) { values.push(from); conditions.push(`l.pickup_date >= $${values.length}`); }
      if (to) { values.push(to); conditions.push(`l.pickup_date <= $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT l.*, d.name AS driver_name, v.unit_number FROM tl_load l
         LEFT JOIN tl_driver d ON d.id = l.driver_id
         LEFT JOIN tl_vehicle v ON v.id = l.vehicle_id
         ${where} ORDER BY l.created_at DESC`,
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
        `INSERT INTO tl_load (load_number,vehicle_id,driver_id,shipper_name,consignee_name,origin_city,origin_province,origin_postal,destination_city,destination_province,destination_postal,commodity,weight_kg,pieces,hazmat,hazmat_class,pickup_date,delivery_date,distance_km,rate,fuel_surcharge,accessorials,total_revenue,driver_pay,status,bol_number,po_number,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
        [body.load_number,body.vehicle_id||null,body.driver_id||null,body.shipper_name,body.consignee_name,body.origin_city,body.origin_province,body.origin_postal,body.destination_city,body.destination_province,body.destination_postal,body.commodity,body.weight_kg||null,body.pieces||null,body.hazmat||false,body.hazmat_class,body.pickup_date||null,body.delivery_date||null,body.distance_km||null,body.rate||null,body.fuel_surcharge||null,body.accessorials||null,body.total_revenue||null,body.driver_pay||null,body.status||'pending',body.bol_number,body.po_number,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
