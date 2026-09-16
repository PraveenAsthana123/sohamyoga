import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      if (body.redeem_amount !== undefined) {
        // Redeem: subtract from balance, deactivate at 0
        const { rows: current } = await client.query(`SELECT * FROM spa_gift_card WHERE id=$1 AND is_active=true`, [params.id]);
        if (!current[0]) return Response.json({ error: 'Gift card not found or inactive' }, { status: 404 });
        const redeemAmount = parseFloat(body.redeem_amount);
        if (redeemAmount > parseFloat(current[0].remaining_balance)) {
          return Response.json({ error: 'Insufficient balance' }, { status: 400 });
        }
        const newBalance = parseFloat(current[0].remaining_balance) - redeemAmount;
        const { rows } = await client.query(`
          UPDATE spa_gift_card SET remaining_balance=$2, is_active=$3 WHERE id=$1 RETURNING *
        `, [params.id, newBalance, newBalance > 0]);
        return Response.json(rows[0]);
      }
      // Generic patch
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(',');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE spa_gift_card SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...vals]);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
