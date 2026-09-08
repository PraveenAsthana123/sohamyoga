import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

const DIRECTIONS = new Set(['inbound','outbound','system']);
const TYPES = new Set(['impression','view','click','reaction','like','unlike','follow','unfollow','share','save','comment','reply','mention','direct_message','email_open','email_click','email_reply','form_submit','lead','conversion','notification_sent','notification_opened','delivery','bounce','complaint']);
const SENTIMENTS = new Set(['positive','neutral','negative','unknown']);
function secretMatches(received: string, expected: string) {
  const a=createHash('sha256').update(received).digest(); const b=createHash('sha256').update(expected).digest(); return timingSafeEqual(a,b);
}
export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const expected=process.env.INTEGRATION_EVENT_SECRET; const received=req.headers.get('x-soham-webhook-secret') ?? '';
  if (!expected || !received || !secretMatches(received,expected)) return Response.json({ error: 'Invalid integration signature.' }, { status: 401 });
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const platform=String(body?.platform??'').trim(); const externalEventId=String(body?.externalEventId??'').trim();
  const direction=String(body?.direction??''); const eventType=String(body?.eventType??'');
  if(!platform||!externalEventId||!DIRECTIONS.has(direction)||!TYPES.has(eventType)) return Response.json({error:'platform, externalEventId, direction, and a supported eventType are required.'},{status:400});
  const sentiment=body?.sentiment?String(body.sentiment):null;
  if(sentiment&&!SENTIMENTS.has(sentiment)) return Response.json({error:'Unsupported sentiment value.'},{status:400});
  const known=await query(`SELECT 1 FROM platform_setup WHERE platform_key=$1`,[platform]);
  if(!known.rowCount) return Response.json({error:'Unknown platform key.'},{status:400});
  const tenantId=await getPrimaryTenantId(); const externalThreadId=String(body?.externalThreadId??'').trim().slice(0,500)||null;
  let threadId:null|string=null;
  if(externalThreadId){const thread=await query<{id:string}>(`INSERT INTO customer_channel_thread
    (tenant_id,platform_key,external_thread_id,customer_reference,status,last_inbound_at,last_outbound_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id,platform_key,external_thread_id) DO UPDATE SET
    customer_reference=COALESCE(EXCLUDED.customer_reference,customer_channel_thread.customer_reference),
    last_inbound_at=COALESCE(EXCLUDED.last_inbound_at,customer_channel_thread.last_inbound_at),
    last_outbound_at=COALESCE(EXCLUDED.last_outbound_at,customer_channel_thread.last_outbound_at),updated_at=now() RETURNING id`,
    [tenantId,platform,externalThreadId,body?.customerReference||null,direction==='inbound'?'waiting_agent':'waiting_customer',direction==='inbound'?body?.occurredAt||new Date():null,direction==='outbound'?body?.occurredAt||new Date():null]);threadId=thread.rows[0].id;}
  const inserted=await query<{id:string}>(`INSERT INTO customer_channel_event
    (tenant_id,thread_id,platform_key,external_event_id,direction,event_type,content_reference,customer_reference,campaign_reference,text_excerpt,sentiment,intent,occurred_at,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
    ON CONFLICT (tenant_id,platform_key,external_event_id) DO NOTHING RETURNING id`,
    [tenantId,threadId,platform,externalEventId.slice(0,500),direction,eventType,body?.contentReference||null,body?.customerReference||null,body?.campaignReference||null,String(body?.text??'').slice(0,4000)||null,sentiment,String(body?.intent??'').slice(0,500)||null,body?.occurredAt||new Date(),JSON.stringify(body?.metadata??{})]);
  return Response.json({ok:true,deduplicated:!inserted.rowCount,eventId:inserted.rows[0]?.id??null,threadId},{status:inserted.rowCount?201:200});
}
