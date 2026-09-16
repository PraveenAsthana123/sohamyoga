import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows: current } = await db.query(`SELECT quoted_amount FROM trade_job WHERE id = $1`, [params.id]);
      if (!current[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const invoicedAmount = body.invoiced_amount || current[0].quoted_amount;
      const { rows } = await db.query(
        `UPDATE trade_job SET invoiced_amount=$1, status='invoiced', actual_end=COALESCE(actual_end,CURRENT_DATE) WHERE id=$2 RETURNING *`,
        [invoicedAmount, params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
