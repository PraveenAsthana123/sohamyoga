import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query, transaction } from '@/lib/postgres';

export const dynamic='force-dynamic';
async function access(req:NextRequest) {
  const auth=await getAdminPrincipal(req);
  if(auth.denied) return auth;
  if(!auth.principal?.roles.includes('Admin')) return {denied:Response.json({error:'Administrator role required.'},{status:403})};
  if(!databaseConfigured()) return {denied:Response.json({error:'Database unavailable.'},{status:503})};
  return auth;
}
export async function GET(req:NextRequest) {
  const auth=await access(req);if(auth.denied)return auth.denied;
  const [vendors,conversions,events]=await Promise.all([
    query(`SELECT v.id,v.name,p.rate_bps,p.enabled FROM vendor v LEFT JOIN affiliate_policy p ON p.vendor_id=v.id ORDER BY v.name`),
    query(`SELECT a.*,v.name,o.order_number,a.earned-a.reversed-a.paid AS balance
      FROM affiliate_conversion a JOIN vendor v ON v.id=a.vendor_id JOIN sales_order o ON o.id=a.order_id
      ORDER BY a.created_at DESC LIMIT 200`),
    query('SELECT * FROM affiliate_event ORDER BY created_at DESC LIMIT 200'),
  ]);
  return Response.json({vendors:vendors.rows,conversions:conversions.rows,events:events.rows});
}
export async function POST(req:NextRequest) {
  const auth=await access(req);if(auth.denied)return auth.denied;
  const b=await req.json().catch(()=>null);
  if(!b || typeof b!=='object')return Response.json({error:'Invalid request.'},{status:400});
  const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
  if(b.action==='policy') {
    if(!uuid(b.vendorId)||!Number.isInteger(b.rateBps)||b.rateBps<0||b.rateBps>10000||typeof b.enabled!=='boolean')
      return Response.json({error:'Vendor, rate from 0–10000 basis points and enabled flag required.'},{status:400});
    const result=await query(`INSERT INTO affiliate_policy(vendor_id,rate_bps,enabled)
      SELECT id,$2,$3 FROM vendor WHERE id=$1
      ON CONFLICT(vendor_id) DO UPDATE SET rate_bps=$2,enabled=$3,updated_at=now() RETURNING vendor_id`,[b.vendorId,b.rateBps,b.enabled]);
    return result.rowCount?Response.json({ok:true}):Response.json({error:'Vendor not found.'},{status:404});
  }
  if(b.action==='payout') {
    if(!uuid(b.orderId)||typeof b.reference!=='string'||!b.reference.trim()||b.reference.length>100||!Number.isInteger(b.amountCents)||b.amountCents<=0||b.amountCents>9999999999)
      return Response.json({error:'Order, positive amount in cents and payment reference required.'},{status:400});
    return transaction(async client=>{
      await client.query('SELECT id FROM sales_order WHERE id=$1 FOR UPDATE',[b.orderId]);
      const row=await client.query(`SELECT earned-reversed-paid AS balance FROM affiliate_conversion WHERE order_id=$1 FOR UPDATE`,[b.orderId]);
      if(!row.rowCount)return Response.json({error:'Conversion not found.'},{status:404});
      const prior=await client.query(`SELECT amount FROM affiliate_event WHERE order_id=$1 AND kind='payout' AND reference=$2`,[b.orderId,b.reference.trim()]);
      if(prior.rowCount) return Math.round(Number(prior.rows[0].amount)*100)===b.amountCents
        ?Response.json({ok:true,replayed:true}):Response.json({error:'Reference already used for another amount.'},{status:409});
      const changed=await client.query(`UPDATE affiliate_conversion SET paid=paid+$2::numeric/100,updated_at=now()
        WHERE order_id=$1 AND earned-reversed-paid >= $2::numeric/100 RETURNING order_id`,[b.orderId,b.amountCents]);
      if(!changed.rowCount)return Response.json({error:'Amount exceeds payable balance.'},{status:409});
      await client.query(`INSERT INTO affiliate_event(order_id,kind,amount,reference,actor)
        VALUES($1,'payout',$2::numeric/100,$3,$4)`,[b.orderId,b.amountCents,b.reference.trim(),auth.principal!.id]);
      return Response.json({ok:true,note:'Recorded an external payment receipt. No money was transferred.'});
    });
  }
  return Response.json({error:'Unknown action.'},{status:400});
}
