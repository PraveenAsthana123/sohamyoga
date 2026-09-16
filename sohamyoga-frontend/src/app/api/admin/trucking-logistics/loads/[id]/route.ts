import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT l.*, d.name AS driver_name, v.unit_number FROM tl_load l LEFT JOIN tl_driver d ON d.id = l.driver_id LEFT JOIN tl_vehicle v ON v.id = l.vehicle_id WHERE l.id = $1`,
        [params.id]
      );
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE tl_load SET vehicle_id=$1,driver_id=$2,shipper_name=$3,consignee_name=$4,origin_city=$5,origin_province=$6,destination_city=$7,destination_province=$8,commodity=$9,weight_kg=$10,pickup_date=$11,delivery_date=$12,distance_km=$13,rate=$14,fuel_surcharge=$15,total_revenue=$16,driver_pay=$17,status=$18,bol_number=$19,po_number=$20,notes=$21 WHERE id=$22 RETURNING *`,
        [body.vehicle_id||null,body.driver_id||null,body.shipper_name,body.consignee_name,body.origin_city,body.origin_province,body.destination_city,body.destination_province,body.commodity,body.weight_kg||null,body.pickup_date||null,body.delivery_date||null,body.distance_km||null,body.rate||null,body.fuel_surcharge||null,body.total_revenue||null,body.driver_pay||null,body.status,body.bol_number,body.po_number,body.notes,params.id]
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
