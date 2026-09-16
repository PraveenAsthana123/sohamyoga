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
      const { rows } = await client.query(`SELECT v.*, d.name AS driver_name FROM tl_vehicle v LEFT JOIN tl_driver d ON d.id = v.current_driver_id WHERE v.id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const maint = await client.query(`SELECT * FROM tl_maintenance WHERE vehicle_id = $1 ORDER BY maintenance_date DESC LIMIT 10`, [params.id]);
      return Response.json({ ...rows[0], maintenance: maint.rows });
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
        `UPDATE tl_vehicle SET unit_number=$1,type=$2,make=$3,model=$4,year=$5,license_plate=$6,province=$7,status=$8,fuel_type=$9,insurance_expiry=$10,registration_expiry=$11,safety_cert_expiry=$12,next_maintenance_km=$13,odometer_km=$14,notes=$15,current_driver_id=$16 WHERE id=$17 RETURNING *`,
        [body.unit_number,body.type,body.make,body.model,body.year||null,body.license_plate,body.province||'AB',body.status,body.fuel_type||'diesel',body.insurance_expiry||null,body.registration_expiry||null,body.safety_cert_expiry||null,body.next_maintenance_km||null,body.odometer_km||0,body.notes,body.current_driver_id||null,params.id]
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
