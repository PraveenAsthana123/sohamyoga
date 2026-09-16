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
      const { rows } = await db.query(`SELECT * FROM trade_material WHERE job_id = $1 ORDER BY created_at`, [params.id]);
      return Response.json(rows);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const db = await pool.connect();
    try {
      const total = body.quantity && body.unit_cost ? parseFloat(body.quantity) * parseFloat(body.unit_cost) : null;
      const { rows } = await db.query(
        `INSERT INTO trade_material (job_id,description,quantity,unit,supplier,unit_cost,total_cost,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [params.id, body.description, body.quantity||null, body.unit, body.supplier, body.unit_cost||null, body.total_cost||total, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
