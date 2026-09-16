import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (client_id) { params.push(parseInt(client_id)); conditions.push(`g.client_id=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`g.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT g.*, c.first_name, c.last_name FROM ot_goal g
       JOIN ot_client c ON c.id=g.client_id ${where} ORDER BY g.created_at DESC`, params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO ot_goal (client_id,ot,occupational_area,goal_description,baseline,target,measurement_method,target_date,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.client_id,b.ot||null,b.occupational_area,b.goal_description,
       b.baseline||null,b.target||null,b.measurement_method||null,
       b.target_date||null,b.status||'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
