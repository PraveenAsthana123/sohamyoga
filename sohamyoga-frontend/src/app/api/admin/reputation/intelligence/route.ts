import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const denied=await requireAdmin(req);if(denied)return denied;const tenantId=await getPrimaryTenantId();
 const [summary,trend,matches,queue]=await Promise.all([
  query(`SELECT count(*)::int total,round(avg(r.star_rating),2) average_rating,
    count(*) FILTER(WHERE r.sentiment='positive')::int positive,count(*) FILTER(WHERE r.sentiment='neutral')::int neutral,
    count(*) FILTER(WHERE r.sentiment='negative')::int negative,count(*) FILTER(WHERE r.reply_text IS NOT NULL)::int responded,
    count(*) FILTER(WHERE r.reply_text IS NULL)::int awaiting_response
    FROM business_review r JOIN google_business_connection c ON c.id=r.connection_id WHERE c.tenant_id=$1`,[tenantId]),
  query(`SELECT date_trunc('week',r.review_created_at)::date AS week,count(*)::int reviews,round(avg(r.star_rating),2) rating,
    count(*) FILTER(WHERE r.sentiment='negative')::int negative FROM business_review r
    JOIN google_business_connection c ON c.id=r.connection_id WHERE c.tenant_id=$1 AND r.review_created_at>=now()-interval '12 weeks'
    GROUP BY 1 ORDER BY 1`,[tenantId]),
  query(`SELECT m.id,m.status,m.confidence,r.reviewer_name,r.star_rating,c.id customer_id,c.display_name,c.email
    FROM review_customer_match m JOIN business_review r ON r.id=m.review_id JOIN customer c ON c.id=m.customer_id
    WHERE c.tenant_id=$1 AND m.status='candidate' ORDER BY m.confidence DESC,r.review_created_at DESC LIMIT 100`,[tenantId]),
  query(`SELECT w.id,w.contact_reference,w.inbound_text,w.sentiment,w.urgency,w.status,w.created_at,r.id review_id,r.star_rating
    FROM marketing_response_work_item w LEFT JOIN business_review r ON r.id::text=w.source_reference
    WHERE w.tenant_id=$1 AND w.source_type='google_business_review' ORDER BY w.created_at DESC LIMIT 100`,[tenantId])]);
 return Response.json({summary:summary.rows[0],trend:trend.rows,customerMatchCandidates:matches.rows,responseQueue:queue.rows,
  automation:{mode:'semi_automatic',identityMatching:'human_confirmation_required',replyPublishing:'human_approval_required'}});
}
