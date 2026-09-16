import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIERS: Record<string, { min: number; next: string | null; nextMin: number }> = {
  bronze: { min: 0, next: 'silver', nextMin: 500 },
  silver: { min: 500, next: 'gold', nextMin: 1500 },
  gold: { min: 1500, next: 'platinum', nextMin: 5000 },
  platinum: { min: 5000, next: null, nextMin: 0 },
};

export async function GET(req: NextRequest, { params }: { params: { customerId: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT id, first_name, last_name, loyalty_points, loyalty_tier, total_spent FROM sr_customer WHERE id=$1`, [parseInt(params.customerId)]);
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const cust = rows[0];
      const tier = TIERS[cust.loyalty_tier] || TIERS.bronze;
      const nextMin = tier.next ? tier.nextMin : null;
      const spentToNext = nextMin ? Math.max(0, nextMin - parseFloat(cust.total_spent)) : null;
      return NextResponse.json({
        ...cust,
        points_value_cad: (cust.loyalty_points / 100).toFixed(2),
        next_tier: tier.next,
        spent_to_next_tier: spentToNext,
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { customerId: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const { points_to_redeem } = await req.json();
    if (!points_to_redeem || points_to_redeem <= 0) return NextResponse.json({ error: 'points_to_redeem must be positive' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows: cur } = await client.query(`SELECT loyalty_points FROM sr_customer WHERE id=$1`, [parseInt(params.customerId)]);
      if (!cur.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (cur[0].loyalty_points < points_to_redeem) return NextResponse.json({ error: 'Insufficient points', available: cur[0].loyalty_points }, { status: 400 });
      const { rows } = await client.query(
        `UPDATE sr_customer SET loyalty_points=loyalty_points-$1 WHERE id=$2 RETURNING id, first_name, last_name, loyalty_points, loyalty_tier`,
        [points_to_redeem, parseInt(params.customerId)]
      );
      return NextResponse.json({ ...rows[0], points_redeemed: points_to_redeem, cad_value: (points_to_redeem/100).toFixed(2) });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
