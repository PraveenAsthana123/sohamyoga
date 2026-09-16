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
      const { rows } = await db.query(`SELECT * FROM trade_client WHERE id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const jobs = await db.query(`SELECT * FROM trade_job WHERE client_id = $1 ORDER BY created_at DESC`, [params.id]);
      return Response.json({ ...rows[0], jobs: jobs.rows });
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
        `UPDATE trade_client SET name=$1,email=$2,phone=$3,address=$4,city=$5,province=$6,client_type=$7,source=$8,status=$9,notes=$10 WHERE id=$11 RETURNING *`,
        [body.name,body.email,body.phone,body.address,body.city,body.province,body.client_type,body.source,body.status,body.notes,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
