// FacebookAutoPublishJob — every 5 minutes.
// Publishes only explicitly approved, due Facebook Page drafts through a real
// connected Postiz integration. It never creates accounts, approves content,
// publishes personal profiles, or treats missing credentials as success.

import { Pool, type PoolClient } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const POSTIZ_BASE = process.env.POSTIZ_PUBLIC_API_BASE || 'http://127.0.0.1:15081/public/v1';
const POSTIZ_KEY = process.env.POSTIZ_PUBLIC_API_KEY || '';

interface Candidate {
  draft_id:string; tenant_id:string; workspace_id:string; master_text:string;
  adapted_text:string; account_id:string; postiz_account_id:string; scheduled_at:string;
}

export function automationPrerequisites(candidateCount:number,apiKey:string){
  if(!apiKey)return{ready:false,reason:'POSTIZ_PUBLIC_API_KEY is missing'};
  if(candidateCount===0)return{ready:false,reason:'no approved due Facebook Page draft with a connected account'};
  return{ready:true,reason:'ready'};
}

async function claim(client:PoolClient):Promise<Candidate|null>{
  const selected=await client.query<Candidate>(
    `SELECT d.id draft_id,d.tenant_id,d.workspace_id,d.master_text,
            COALESCE(NULLIF(v.adapted_text,''),d.master_text) adapted_text,
            a.id account_id,a.postiz_account_id,
            COALESCE(v.scheduled_at,d.default_schedule_at) scheduled_at
     FROM social_content_draft d
     JOIN social_platform_variant v ON v.draft_id=d.id AND v.platform='facebook' AND v.status='pending'
     JOIN social_account a ON a.id=v.account_id AND a.platform='facebook' AND a.status='connected'
     WHERE d.status='approved' AND d.reviewed_by IS NOT NULL AND d.reviewed_at IS NOT NULL
       AND a.postiz_account_id IS NOT NULL
       AND COALESCE(v.scheduled_at,d.default_schedule_at)<=now()
     ORDER BY COALESCE(v.scheduled_at,d.default_schedule_at),d.created_at
     FOR UPDATE OF d,v SKIP LOCKED LIMIT 1`,
  );
  if(!selected.rowCount)return null;
  await client.query(`UPDATE social_content_draft SET status='publishing',updated_at=now() WHERE id=$1`,[selected.rows[0].draft_id]);
  return selected.rows[0];
}

async function publish(candidate:Candidate){
  const response=await fetch(`${POSTIZ_BASE}/posts`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':POSTIZ_KEY},body:JSON.stringify({
    type:'now',date:new Date().toISOString(),shortLink:false,tags:[],posts:[{integration:{id:candidate.postiz_account_id},value:[{content:candidate.adapted_text}]}],
  }),signal:AbortSignal.timeout(30_000)});
  const text=await response.text();if(!response.ok)throw new Error(`Postiz HTTP ${response.status}: ${text.slice(0,300)}`);
  return text?JSON.parse(text) as Record<string,unknown>:{};
}

export async function run():Promise<void>{
  if(!POSTIZ_KEY){console.warn('[facebook-auto-publish] blocked: POSTIZ_PUBLIC_API_KEY is missing');return;}
  let published=0;
  for(let count=0;count<10;count++){
    const client=await db.connect();let candidate:Candidate|null=null;
    try{await client.query('BEGIN');candidate=await claim(client);await client.query('COMMIT')}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
    if(!candidate)break;
    const idempotencyKey=`facebook:${candidate.draft_id}:${candidate.account_id}`;
    try{
      const result=await publish(candidate);const externalId=typeof result.id==='string'?result.id:null;
      const successClient=await db.connect();
      try{
        await successClient.query('BEGIN');
        await successClient.query(`INSERT INTO social_post(tenant_id,workspace_id,draft_id,platform,account_id,idempotency_key,scheduled_at,published_at,status,external_post_id) VALUES($1,$2,$3,'facebook',$4,$5,$6,now(),'published',$7) ON CONFLICT(idempotency_key) DO NOTHING`,[candidate.tenant_id,candidate.workspace_id,candidate.draft_id,candidate.account_id,idempotencyKey,candidate.scheduled_at,externalId]);
        await successClient.query(`UPDATE social_platform_variant SET status='published',platform_post_id=COALESCE($2,platform_post_id) WHERE draft_id=$1 AND platform='facebook'`,[candidate.draft_id,externalId]);
        await successClient.query(`UPDATE social_content_draft SET status='published',updated_at=now() WHERE id=$1`,[candidate.draft_id]);
        await successClient.query('COMMIT');published++;
      }catch(error){await successClient.query('ROLLBACK');throw error}finally{successClient.release()}
    }catch(error){
      await db.query(`UPDATE social_content_draft SET status='approved',updated_at=now() WHERE id=$1`,[candidate.draft_id]);
      await db.query(`UPDATE social_platform_variant SET error_message=$2,retry_count=LEAST(retry_count+1,3) WHERE draft_id=$1 AND platform='facebook'`,[candidate.draft_id,error instanceof Error?error.message.slice(0,500):'Unknown Postiz error']);
      console.error(`[facebook-auto-publish] draft=${candidate.draft_id} failed`,error);break;
    }
  }
  console.log(`[facebook-auto-publish] published=${published}`);
}
