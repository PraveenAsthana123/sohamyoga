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
    const db = await pool.connect();
    try {
      const { rows } = await db.query(`SELECT * FROM rh_location WHERE id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { db.release(); }
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
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `UPDATE rh_location SET name=$1,address=$2,city=$3,province=$4,phone=$5,email=$6,cuisine_type=$7,seating_capacity=$8,patio_capacity=$9,pos_system=$10,liquor_license=$11,liquor_license_expiry=$12,health_inspection_date=$13,health_inspection_score=$14,status=$15,manager_name=$16 WHERE id=$17 RETURNING *`,
        [body.name,body.address,body.city,body.province,body.phone,body.email,body.cuisine_type,body.seating_capacity||null,body.patio_capacity||0,body.pos_system,body.liquor_license,body.liquor_license_expiry||null,body.health_inspection_date||null,body.health_inspection_score||null,body.status,body.manager_name,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
