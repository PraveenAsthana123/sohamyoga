import type { PoolClient } from 'pg';

export const AFFILIATE_COOKIE = 'soham_affiliate_click';
export const ATTRIBUTION_SECONDS = 30 * 86400;

/** Caller locks sales_order first; all write paths use order -> conversion lock order. */
export async function attachAffiliate(client: PoolClient, orderId: string, clickId: string | undefined) {
  if (!clickId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clickId)) return;
  const inserted = await client.query<{referral_code_id:string}>(
    `INSERT INTO affiliate_conversion(order_id,vendor_id,referral_code_id,click_id,rate_bps,basis,currency)
     SELECT o.id,v.id,rc.id,cl.id,p.rate_bps,
       greatest(0,o.subtotal-o.discount_amount-o.coupon_discount-o.reward_points_value),o.currency
     FROM sales_order o JOIN referral_click cl ON cl.id=$2
     JOIN referral_code rc ON rc.id=cl.referral_code_id
     JOIN vendor v ON v.id=rc.referrer_id
     JOIN affiliate_policy p ON p.vendor_id=v.id AND p.enabled
     WHERE o.id=$1 AND o.status='draft' AND o.payment_status='pending'
       AND rc.referrer_type='affiliate' AND rc.status='active'
       AND (rc.expires_at IS NULL OR rc.expires_at>now())
       AND (rc.max_uses IS NULL OR rc.used_count<rc.max_uses)
       AND cl.clicked_at>now()-interval '30 days' AND cl.clicked_at<=now()
       AND lower(o.customer_email)<>lower(v.email)
     ON CONFLICT(order_id) DO NOTHING RETURNING referral_code_id`, [orderId,clickId]);
  if (inserted.rowCount) {
    // Reserve a use at checkout; cancellation does not reopen exhausted promotions.
    const used = await client.query(`UPDATE referral_code SET used_count=used_count+1,updated_at=now()
      WHERE id=$1 AND status='active' AND (max_uses IS NULL OR used_count<max_uses)
      AND (expires_at IS NULL OR expires_at>now()) RETURNING id`, [inserted.rows[0].referral_code_id]);
    if (!used.rowCount) await client.query('DELETE FROM affiliate_conversion WHERE order_id=$1',[orderId]);
  }
}

export async function reconcileAffiliate(client: PoolClient, orderId: string, actor: string) {
  // PostgreSQL numeric performs monetary rounding; no binary float arithmetic.
  const earned = await client.query<{amount:string}>(`UPDATE affiliate_conversion a
    SET earned=round(a.basis*a.rate_bps/10000,2),updated_at=now()
    FROM sales_order o WHERE a.order_id=$1 AND o.id=a.order_id
      AND o.payment_status='paid' AND o.status NOT IN ('draft','cancelled','returned','refunded')
      AND a.earned=0 AND round(a.basis*a.rate_bps/10000,2)>0 RETURNING a.earned AS amount`,[orderId]);
  if (earned.rowCount) await client.query(`INSERT INTO affiliate_event(order_id,kind,amount,actor)
    VALUES($1,'earned',$2,$3)`,[orderId,earned.rows[0].amount,actor]);
  const row=await client.query<{earned:string;reversed:string;target:string}>(`SELECT a.earned,a.reversed,
    CASE WHEN o.status IN ('cancelled','returned') THEN a.earned
      ELSE least(a.earned,round(a.earned*o.refund_amount/nullif(o.total,0),2)) END AS target
    FROM affiliate_conversion a JOIN sales_order o ON o.id=a.order_id WHERE a.order_id=$1 FOR UPDATE OF a`,[orderId]);
  if (!row.rowCount) return;
  const r=row.rows[0];
  if (Number(r.target)>Number(r.reversed)) {
    await client.query(`INSERT INTO affiliate_event(order_id,kind,amount,actor)
      VALUES($1,'reversal',$2::numeric-$3::numeric,$4)`,[orderId,r.target,r.reversed,actor]);
    await client.query('UPDATE affiliate_conversion SET reversed=$2,updated_at=now() WHERE order_id=$1',[orderId,r.target]);
  }
}
