import { query } from '@/lib/postgres';
import { classifySentiment } from '@/lib/sentiment';

type ReviewInput={id:string;googleReviewId:string;reviewerName:string;starRating:number|null;comment:string|null;createdAt:string|null};

export async function processReview(tenantId:string, review:ReviewInput):Promise<void>{
  const policy=await query<{enabled:boolean;auto_classify_sentiment:boolean;create_response_work_items:boolean;negative_review_priority:string}>(
    `SELECT enabled,auto_classify_sentiment,create_response_work_items,negative_review_priority FROM reputation_automation_policy WHERE tenant_id=$1`,[tenantId]);
  if(!policy.rows[0]?.enabled)return;
  let sentiment:'positive'|'neutral'|'negative'=review.starRating&&review.starRating<=2?'negative':review.starRating&&review.starRating>=4?'positive':'neutral';
  let confidence=0.75;let reason='Deterministic star-rating classification.';
  // Google supplies a rating for normal reviews; keep bulk sync deterministic
  // and fast. Use the model only for an unusual unrated text review.
  if(policy.rows[0].auto_classify_sentiment&&review.starRating==null&&review.comment?.trim()){
    try{const classified=await classifySentiment(review.comment);sentiment=classified.sentiment;confidence=classified.confidence;reason=classified.reason;}
    catch(error){reason=`Star-rating fallback; classifier unavailable: ${error instanceof Error?error.message:'unknown error'}`;}
  }
  await query(`UPDATE business_review SET sentiment=$2,sentiment_confidence=$3,sentiment_reason=$4,workflow_status='needs_review' WHERE id=$1`,[review.id,sentiment,confidence,reason]);

  // A public display name is only a candidate identity signal. Staff must confirm it.
  if(review.reviewerName&&review.reviewerName!=='Anonymous')await query(`INSERT INTO review_customer_match(review_id,customer_id,match_method,confidence)
    SELECT $1,id,'display_name_exact',0.65 FROM customer WHERE tenant_id=$2 AND lower(display_name)=lower($3)
    ON CONFLICT(review_id,customer_id) DO NOTHING`,[review.id,tenantId,review.reviewerName]);

  const thread=await query<{id:string}>(`INSERT INTO customer_channel_thread
    (tenant_id,platform_key,external_thread_id,customer_reference,status,last_inbound_at)
    VALUES ($1,'google_business',$2,$3,'waiting_agent',$4)
    ON CONFLICT(tenant_id,platform_key,external_thread_id) DO UPDATE SET last_inbound_at=EXCLUDED.last_inbound_at,updated_at=now()
    RETURNING id`,[tenantId,`review:${review.googleReviewId}`,review.reviewerName,review.createdAt||new Date()]);
  await query(`INSERT INTO customer_channel_event
    (tenant_id,thread_id,platform_key,external_event_id,direction,event_type,customer_reference,text_excerpt,sentiment,occurred_at,metadata)
    VALUES($1,$2,'google_business',$3,'inbound','comment',$4,$5,$6,$7,$8::jsonb)
    ON CONFLICT(tenant_id,platform_key,external_event_id) DO UPDATE SET text_excerpt=EXCLUDED.text_excerpt,sentiment=EXCLUDED.sentiment,metadata=EXCLUDED.metadata`,
    [tenantId,thread.rows[0].id,`review:${review.googleReviewId}`,review.reviewerName,review.comment,sentiment,review.createdAt||new Date(),JSON.stringify({reviewId:review.id,starRating:review.starRating,source:'google_business_review'})]);

  if(policy.rows[0].create_response_work_items){const work=await query<{id:string}>(`INSERT INTO marketing_response_work_item
    (tenant_id,channel,external_thread_id,contact_reference,inbound_text,intent,sentiment,urgency,status,source_type,source_reference)
    VALUES($1,'google_business',$2,$3,$4,'public_review',$5,$6,'needs_review','google_business_review',$7)
    ON CONFLICT(tenant_id,source_type,source_reference) WHERE source_type IS NOT NULL AND source_reference IS NOT NULL
    DO UPDATE SET inbound_text=EXCLUDED.inbound_text,sentiment=EXCLUDED.sentiment,urgency=EXCLUDED.urgency,updated_at=now() RETURNING id`,
    [tenantId,`review:${review.googleReviewId}`,review.reviewerName,review.comment||`Star rating: ${review.starRating??'unknown'}`,sentiment,sentiment==='negative'?policy.rows[0].negative_review_priority:'medium',review.id]);
    await query(`UPDATE business_review SET response_work_item_id=$2 WHERE id=$1`,[review.id,work.rows[0].id]);}
}
