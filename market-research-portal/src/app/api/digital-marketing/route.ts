import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

export const dynamic='force-dynamic';

async function handleGet(req:NextRequest){
 const denied=await requireAdmin(req); if(denied)return denied;
 const [workspace,channels,assets,jobs,interactions,forms,events]=await Promise.all([
  query(`SELECT * FROM marketing_workspace ORDER BY created_at LIMIT 1`),
  query(`SELECT channel,provider,status,external_account_label,last_health_at,last_error FROM marketing_channel_connection ORDER BY channel`),
  query(`SELECT id,campaign_id,asset_type,title,status,file_path,mime_type,provider,duration_seconds,created_at FROM marketing_asset ORDER BY created_at DESC LIMIT 50`),
  query(`SELECT id,campaign_id,asset_id,job_type,status,scheduled_at,attempts,blocker,error_message,created_at FROM marketing_production_job ORDER BY created_at DESC LIMIT 100`),
  query(`SELECT id,campaign_id,channel,direction,interaction_type,customer_address,sentiment,intent,response_status,assigned_to,occurred_at FROM marketing_interaction ORDER BY occurred_at DESC LIMIT 100`),
  query(`SELECT * FROM marketing_form_link ORDER BY created_at DESC LIMIT 50`),
  query(`SELECT event_name,entity_type,entity_id,actor,provider,outcome,occurred_at FROM marketing_event_log ORDER BY occurred_at DESC LIMIT 100`),
 ]);
 return Response.json({workspace:workspace.rows[0]??null,channels:channels.rows,assets:assets.rows,jobs:jobs.rows,interactions:interactions.rows,forms:forms.rows,events:events.rows});
}

async function handlePost(req:NextRequest){
 const denied=await requireAdmin(req); if(denied)return denied;
 const body=await req.json().catch(()=>null) as any; if(!body)return Response.json({error:'Invalid body.'},{status:400});
 const w=await query<{id:string}>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`); const workspaceId=w.rows[0]?.id;
 if(!workspaceId)return Response.json({error:'Workspace missing.'},{status:503});
 if(body.action==='form_link'){
  if(!body.name||!body.destinationUrl)return Response.json({error:'name and destinationUrl required.'},{status:400});
  let u:URL; try{u=new URL(body.destinationUrl)}catch{return Response.json({error:'destinationUrl must be an absolute URL.'},{status:400})}
  if(!['http:','https:'].includes(u.protocol))return Response.json({error:'Only HTTP(S) form URLs are allowed.'},{status:400});
  const slug=`${String(body.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)}-${Date.now().toString(36)}`;
  const r=await query(`INSERT INTO marketing_form_link(workspace_id,campaign_id,name,slug,destination_url,utm_source,utm_medium,utm_campaign) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[workspaceId,body.campaignId||null,body.name,slug,u.toString(),body.utmSource||null,body.utmMedium||null,body.utmCampaign||null]);
  await query(`INSERT INTO marketing_event_log(workspace_id,campaign_id,event_name,entity_type,entity_id,actor,outcome) VALUES($1,$2,'form_link.created','form_link',$3,'admin','success')`,[workspaceId,body.campaignId||null,r.rows[0].id]);
  return Response.json({form:r.rows[0]},{status:201});
 }
 if(body.action==='schedule_publish'){
  if(!body.assetId||!body.channel||!body.scheduledAt)return Response.json({error:'assetId, channel and scheduledAt required.'},{status:400});
  const connection=await query<{status:string}>(`SELECT status FROM marketing_channel_connection WHERE workspace_id=$1 AND channel=$2`,[workspaceId,body.channel]);
  const connected=connection.rows[0]?.status==='connected';
  const key=`publish:${body.channel}:${body.assetId}:${body.scheduledAt}`;
  const r=await query(`INSERT INTO marketing_production_job(workspace_id,campaign_id,asset_id,job_type,status,scheduled_at,idempotency_key,input,blocker) SELECT $1,a.campaign_id,a.id,$2,$3,$4,$5,$6,$7 FROM marketing_asset a WHERE a.id=$8 AND a.status='approved' RETURNING *`,[workspaceId,body.channel==='youtube'?'youtube_publish':'social_publish',connected?'queued':'blocked',body.scheduledAt,key,JSON.stringify({channel:body.channel}),connected?null:`${body.channel} account is not connected`,body.assetId]);
  if(!r.rowCount)return Response.json({error:'Asset must exist and be approved before scheduling.'},{status:409});
  return Response.json({job:r.rows[0]},{status:201});
 }
 if(body.action==='approve_asset'){
  if(!body.assetId)return Response.json({error:'assetId required.'},{status:400});
  const r=await query(`UPDATE marketing_asset SET status='approved',approved_by='admin',approved_at=now(),updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status='ready_for_review' RETURNING *`,[body.assetId,workspaceId]);
  if(!r.rowCount)return Response.json({error:'Only ready-for-review assets can be approved.'},{status:409});
  await query(`INSERT INTO marketing_event_log(workspace_id,campaign_id,event_name,entity_type,entity_id,actor,outcome) VALUES($1,$2,'asset.approved','asset',$3,'admin','success')`,[workspaceId,r.rows[0].campaign_id,r.rows[0].id]);
  return Response.json({asset:r.rows[0]});
 }
 return Response.json({error:'Unknown action.'},{status:400});
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
