import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ valid: false, reason: 'Invalid request.' }, { status: 400 });

  const { code, order_total } = body as Record<string, unknown>;
  if (!code || typeof code !== 'string') return Response.json({ valid: false, reason: 'code required.' });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM coupon WHERE code = $1`,
      [code.trim().toUpperCase()]
    );
    if (!result.rowCount) return Response.json({ valid: false, reason: 'Coupon not found.' });

    const coupon = result.rows[0] as {
      id: number; is_active: boolean; valid_from: string; valid_until: string | null;
      max_uses: number | null; used_count: number; min_order_value: number;
      discount_type: string; discount_value: number; coupon_type: string;
    };

    if (!coupon.is_active) return Response.json({ valid: false, reason: 'Coupon is inactive.' });

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return Response.json({ valid: false, reason: 'Coupon not yet valid.' });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return Response.json({ valid: false, reason: 'Coupon has expired.' });
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return Response.json({ valid: false, reason: 'Coupon usage limit reached.' });
    }

    const total = typeof order_total === 'number' ? order_total : 0;
    if (coupon.min_order_value && total < coupon.min_order_value) {
      return Response.json({ valid: false, reason: `Minimum order value $${coupon.min_order_value} required.` });
    }

    let discount_amount = 0;
    if (coupon.discount_type === 'percentage') {
      discount_amount = Math.min(total * (coupon.discount_value / 100), total);
    } else {
      discount_amount = Math.min(coupon.discount_value, total);
    }

    return Response.json({
      valid: true,
      discount_value: coupon.discount_value,
      discount_type: coupon.discount_type,
      discount_amount: Math.round(discount_amount * 100) / 100,
    });
  } finally {
    client.release();
  }
}
