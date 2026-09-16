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
      const { rows } = await client.query(`SELECT * FROM tl_driver WHERE id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const loads = await client.query(`SELECT * FROM tl_load WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 10`, [params.id]);
      return Response.json({ ...rows[0], recent_loads: loads.rows });
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
        `UPDATE tl_driver SET name=$1,email=$2,phone=$3,license_number=$4,license_class=$5,license_expiry=$6,abstract_date=$7,medical_expiry=$8,status=$9,employment_type=$10,base_city=$11,province=$12,hourly_rate=$13,per_km_rate=$14,per_load_rate=$15,notes=$16 WHERE id=$17 RETURNING *`,
        [body.name,body.email,body.phone,body.license_number,body.license_class,body.license_expiry||null,body.abstract_date||null,body.medical_expiry||null,body.status,body.employment_type,body.base_city,body.province,body.hourly_rate||null,body.per_km_rate||null,body.per_load_rate||null,body.notes,params.id]
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
