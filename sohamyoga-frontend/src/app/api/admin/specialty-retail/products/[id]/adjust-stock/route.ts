import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const { adjustment, reason } = await req.json();
    if (adjustment === undefined) return NextResponse.json({ error: 'adjustment required (positive=received, negative=sold/shrinkage)' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE sr_product SET stock_quantity = stock_quantity + $1 WHERE id=$2 RETURNING *`,
        [parseInt(adjustment), parseInt(params.id)]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ product: rows[0], adjustment, reason: reason || null });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
