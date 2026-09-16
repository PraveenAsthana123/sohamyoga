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
      const { rows } = await db.query(`SELECT s.*, l.name AS location_name FROM rh_staff s LEFT JOIN rh_location l ON l.id = s.location_id WHERE s.id = $1`, [params.id]);
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
        `UPDATE rh_staff SET location_id=$1,name=$2,role=$3,employment_type=$4,hourly_rate=$5,status=$6,start_date=$7,food_safe_expiry=$8,serving_it_right_expiry=$9,notes=$10 WHERE id=$11 RETURNING *`,
        [body.location_id,body.name,body.role,body.employment_type,body.hourly_rate||null,body.status,body.start_date||null,body.food_safe_expiry||null,body.serving_it_right_expiry||null,body.notes,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
