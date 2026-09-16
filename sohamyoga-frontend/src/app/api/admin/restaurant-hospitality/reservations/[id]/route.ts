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
      const { rows } = await db.query(`SELECT r.*, l.name AS location_name FROM rh_reservation r LEFT JOIN rh_location l ON l.id = r.location_id WHERE r.id = $1`, [params.id]);
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
        `UPDATE rh_reservation SET guest_name=$1,phone=$2,email=$3,party_size=$4,reservation_date=$5,reservation_time=$6,duration_minutes=$7,table_number=$8,section=$9,status=$10,special_requests=$11,occasion=$12,source=$13 WHERE id=$14 RETURNING *`,
        [body.guest_name,body.phone,body.email,body.party_size,body.reservation_date,body.reservation_time,body.duration_minutes||90,body.table_number,body.section,body.status,body.special_requests,body.occasion,body.source,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
