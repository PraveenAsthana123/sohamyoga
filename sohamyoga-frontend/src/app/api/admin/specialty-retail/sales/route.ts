import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GST_RATE = 0.05;
const LOYALTY_RATE = 10; // 10 pts per $1 spent
const LOYALTY_TIER_THRESHOLDS = { silver: 500, gold: 1500, platinum: 5000 };

function calcLoyaltyTier(spent: number): string {
  if (spent >= LOYALTY_TIER_THRESHOLDS.platinum) return 'platinum';
  if (spent >= LOYALTY_TIER_THRESHOLDS.gold) return 'gold';
  if (spent >= LOYALTY_TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const staff = searchParams.get('staff');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT s.*, c.first_name, c.last_name FROM sr_sale s LEFT JOIN sr_customer c ON c.id=s.customer_id WHERE 1=1`;
      const params: any[] = [];
      if (date) { params.push(date); q += ` AND DATE(s.sale_date)=$${params.length}`; }
      if (staff) { params.push(staff); q += ` AND s.staff_name=$${params.length}`; }
      q += ` ORDER BY s.sale_date DESC LIMIT 100`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { items, customer_id, payment_method, staff_name, loyalty_points_redeemed = 0, discount_amount = 0, notes } = body;
    if (!items || !items.length) return NextResponse.json({ error: 'items required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Validate and get products
      const productIds = items.map((i: any) => i.product_id);
      const prodRes = await client.query(`SELECT * FROM sr_product WHERE id = ANY($1::int[])`, [productIds]);
      const prodMap: Record<number, any> = {};
      for (const p of prodRes.rows) prodMap[p.id] = p;
      let subtotal = 0;
      const saleItems: Array<{product_id:number;quantity:number;unit_price:number;discount_pct:number;line_total:number}> = [];
      for (const item of items) {
        const prod = prodMap[item.product_id];
        if (!prod) throw new Error(`Product ${item.product_id} not found`);
        const unit_price = parseFloat(item.unit_price || (prod.is_on_sale && prod.sale_price ? prod.sale_price : prod.retail_price));
        const discount_pct = parseFloat(item.discount_pct || 0);
        const line_total = unit_price * item.quantity * (1 - discount_pct/100);
        subtotal += line_total;
        saleItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price, discount_pct, line_total });
      }
      const loyaltyDiscount = loyalty_points_redeemed * 0.01; // 100 pts = $1
      const taxableAmount = Math.max(0, subtotal - discount_amount - loyaltyDiscount);
      const gst_amount = Math.round(taxableAmount * GST_RATE * 100) / 100;
      const total_amount = taxableAmount + gst_amount;
      const loyalty_points_earned = Math.floor(total_amount * LOYALTY_RATE);
      // Insert sale
      const saleRes = await client.query(
        `INSERT INTO sr_sale (customer_id, subtotal, discount_amount, gst_amount, total_amount, loyalty_points_earned, loyalty_points_redeemed, payment_method, staff_name, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [customer_id||null, subtotal, discount_amount, gst_amount, total_amount, loyalty_points_earned, loyalty_points_redeemed, payment_method, staff_name||null, notes||null]
      );
      const saleId = saleRes.rows[0].id;
      // Insert sale items + deduct stock
      for (const si of saleItems) {
        await client.query(
          `INSERT INTO sr_sale_item (sale_id, product_id, quantity, unit_price, discount_pct, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
          [saleId, si.product_id, si.quantity, si.unit_price, si.discount_pct, si.line_total]
        );
        await client.query(`UPDATE sr_product SET stock_quantity = stock_quantity - $1 WHERE id=$2`, [si.quantity, si.product_id]);
      }
      // Update customer loyalty if provided
      if (customer_id) {
        const custRes = await client.query(
          `UPDATE sr_customer SET loyalty_points=loyalty_points+$1-$2, total_purchases=total_purchases+1, total_spent=total_spent+$3, last_purchase_date=CURRENT_DATE WHERE id=$4 RETURNING total_spent`,
          [loyalty_points_earned, loyalty_points_redeemed, total_amount, customer_id]
        );
        if (custRes.rows.length) {
          const newTier = calcLoyaltyTier(parseFloat(custRes.rows[0].total_spent));
          await client.query(`UPDATE sr_customer SET loyalty_tier=$1 WHERE id=$2`, [newTier, customer_id]);
        }
      }
      await client.query('COMMIT');
      return NextResponse.json({ sale: saleRes.rows[0], items: saleItems }, { status: 201 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
