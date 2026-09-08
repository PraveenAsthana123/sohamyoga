import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getValidAccessToken } from '@/domain/reputation/reputationCredentialOps';
import { replyToReview, GoogleBusinessApiError } from '@/domain/reputation/GoogleBusinessReviewAdapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — really posts the reply to Google (not just saved locally), then
// records it. Fails closed if not connected or if Google rejects the reply.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { comment?: string } | null;
  if (!body?.comment?.trim()) return Response.json({ error: 'comment is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const accessToken = await getValidAccessToken(tenantId);
  if (!accessToken) return Response.json({ error: 'Google Business Profile is not connected.' }, { status: 409 });

  const row = await query<{ google_review_id: string; business_location_id: string }>(
    `SELECT r.google_review_id, c.business_location_id
     FROM business_review r JOIN google_business_connection c ON c.id = r.connection_id
     WHERE r.id = $1 AND c.tenant_id = $2`,
    [params.id, tenantId],
  );
  if (!row.rows.length) return Response.json({ error: 'Review not found.' }, { status: 404 });
  const { google_review_id: googleReviewId, business_location_id: locationName } = row.rows[0];

  try {
    await replyToReview(accessToken, locationName, googleReviewId, body.comment.trim());
    await query(`UPDATE business_review SET reply_text=$2,reply_updated_at=now(),workflow_status='responded' WHERE id=$1`, [params.id, body.comment.trim()]);
    await query(`UPDATE marketing_response_work_item SET status='sent',sent_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND source_type='google_business_review' AND source_reference=$2`,[tenantId,params.id]);
    await query(`INSERT INTO customer_channel_event
      (tenant_id,thread_id,platform_key,external_event_id,direction,event_type,text_excerpt,occurred_at,metadata)
      SELECT $1,t.id,'google_business',$2,'outbound','reply',$3,now(),$4::jsonb FROM customer_channel_thread t
      WHERE t.tenant_id=$1 AND t.platform_key='google_business' AND t.external_thread_id=$5
      ON CONFLICT(tenant_id,platform_key,external_event_id) DO NOTHING`,
      [tenantId,`reply:${params.id}:${Date.now()}`,body.comment.trim(),JSON.stringify({reviewId:params.id,providerConfirmed:true}),`review:${googleReviewId}`]);
    await query(`UPDATE customer_channel_thread SET status='waiting_customer',last_outbound_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND platform_key='google_business' AND external_thread_id=$2`,[tenantId,`review:${googleReviewId}`]);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof GoogleBusinessApiError ? err.status : 502;
    return Response.json({ error: message }, { status });
  }
}
