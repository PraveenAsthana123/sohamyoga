import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM fa_holding WHERE account_id = $1 ORDER BY market_value DESC NULLS LAST`,
      [id]
    );
    return Response.json({ holdings: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || !b.fund_name) return Response.json({ error: 'fund_name required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const qty = b.quantity ? Number(b.quantity) : null;
    const avgCost = b.avg_cost ? Number(b.avg_cost) : null;
    const price = b.current_price ? Number(b.current_price) : null;
    const marketValue = b.market_value
      ? Number(b.market_value)
      : (qty && price ? qty * price : null);

    const result = await client.query(`
      INSERT INTO fa_holding
        (account_id, ticker, fund_name, asset_class, geography, quantity, avg_cost,
         current_price, market_value, weight_pct, asset_type, provider, mer_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      Number(id), b.ticker || null, b.fund_name,
      b.asset_class || null, b.geography || null,
      qty, avgCost, price, marketValue,
      b.weight_pct ? Number(b.weight_pct) : null,
      b.asset_type || null, b.provider || null,
      b.mer_pct ? Number(b.mer_pct) : null,
    ]);

    // Update account book_value and current_value
    await client.query(`
      UPDATE fa_account SET
        current_value = (SELECT COALESCE(SUM(market_value),0) FROM fa_holding WHERE account_id = $1),
        book_value = (SELECT COALESCE(SUM(quantity * avg_cost),0) FROM fa_holding WHERE account_id = $1 AND avg_cost IS NOT NULL AND quantity IS NOT NULL),
        updated_at = NOW()
      WHERE id = $1
    `, [id]);

    return Response.json({ holding: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
