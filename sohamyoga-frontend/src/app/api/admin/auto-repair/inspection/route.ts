import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { work_order_id, tire_tread_mm, battery_cca, brake_pct_front, brake_pct_rear, inspection_notes } = body;
  if (!work_order_id) return Response.json({ error: 'work_order_id required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      UPDATE ar_work_order
      SET inspection_complete=true, inspection_notes=$1, tire_tread_mm=$2, battery_cca=$3,
          brake_pct_front=$4, brake_pct_rear=$5
      WHERE id=$6 RETURNING *
    `, [inspection_notes||null, tire_tread_mm||null, battery_cca||null, brake_pct_front||null, brake_pct_rear||null, work_order_id]);
    if (!rows.length) return Response.json({ error: 'Work order not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
