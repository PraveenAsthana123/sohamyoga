// Publishes independently approved Facebook and LinkedIn variants through Postiz.
// The master draft completes only after every variant has reached a terminal state.
import{Pool,type PoolClient}from'pg';
import{providerFor,acceptedPostId,publicationReceipt}from'@/domain/social/PostizProtocol';
const db=new Pool({connectionString:process.env.DATABASE_URL});
const BASE=process.env.POSTIZ_PUBLIC_API_BASE||'http://127.0.0.1:15081/public/v1';
const KEY=process.env.POSTIZ_PUBLIC_API_KEY||'';
export const AUTOMATED_POSTIZ_PLATFORMS=['facebook','linkedin','youtube','instagram','x_twitter']as const;
type Platform=typeof AUTOMATED_POSTIZ_PLATFORMS[number];
export type Candidate={draft_id:string;tenant_id:string;workspace_id:string;adapted_text:string;account_id:string;postiz_account_id:string;scheduled_at:string;platform:Platform;video_title:string|null;postiz_media_id:string|null;postiz_media_path:string|null;youtube_visibility:'public'|'private'|'unlisted';youtube_tags:string[];provider_identifier?:string;content_type?:string};

export function automationPrerequisites(count:number,key:string){
 if(!key)return{ready:false,reason:'POSTIZ_PUBLIC_API_KEY is missing'};
 if(!count)return{ready:false,reason:'no approved due supported variant with a connected Postiz account'};
 return{ready:true,reason:'ready'};
}
async function claim(client:PoolClient):Promise<Candidate|null>{
 const selected=await client.query<Candidate>(`SELECT d.id draft_id,d.tenant_id,d.workspace_id,COALESCE(NULLIF(v.adapted_text,''),d.master_text) adapted_text,a.id account_id,a.postiz_account_id,COALESCE(v.scheduled_at,d.default_schedule_at) scheduled_at,v.platform,v.video_title,v.postiz_media_id,v.postiz_media_path,v.youtube_visibility,v.youtube_tags,d.content_type
 FROM social_content_draft d JOIN social_platform_variant v ON v.draft_id=d.id AND v.platform=ANY($1) AND v.status='pending'
 JOIN social_account a ON a.id=v.account_id AND a.platform=v.platform AND a.status='connected' AND a.tenant_id=d.tenant_id AND a.workspace_id=d.workspace_id
 WHERE d.status='approved' AND v.retry_count<3 AND NOT EXISTS(SELECT 1 FROM social_post p WHERE p.idempotency_key=v.platform||':'||d.id::text||':'||a.id::text) AND d.reviewed_by IS NOT NULL AND d.reviewed_at IS NOT NULL AND a.postiz_account_id IS NOT NULL
 AND (v.platform<>'youtube' OR (v.video_title IS NOT NULL AND char_length(v.video_title) BETWEEN 2 AND 100 AND v.postiz_media_id IS NOT NULL AND v.postiz_media_path~*'\\.mp4([?#].*)?$'))
 AND COALESCE(v.scheduled_at,d.default_schedule_at)<=now() ORDER BY COALESCE(v.scheduled_at,d.default_schedule_at),d.created_at
 FOR UPDATE OF d,v SKIP LOCKED LIMIT 1`,[AUTOMATED_POSTIZ_PLATFORMS]);
 if(!selected.rowCount)return null;
 await client.query(`UPDATE social_content_draft SET status='publishing',updated_at=now() WHERE id=$1`,[selected.rows[0].draft_id]);return selected.rows[0];
}
export function buildPostizPayload(c:Candidate){
 const identifier=providerFor(c.platform,c.provider_identifier||(c.platform==='x_twitter'?'x':c.platform));
 const youtube=c.platform==='youtube';const instagram=c.platform==='instagram';
 const media=c.postiz_media_id&&c.postiz_media_path?[{id:c.postiz_media_id,path:c.postiz_media_path}]:[];
 if((youtube||instagram)&&!media.length)throw Error('Uploaded Postiz media is required for this platform');
 if(youtube&&(!c.video_title||c.video_title.length<2||c.video_title.length>100||! /\.mp4([?#].*)?$/i.test(c.postiz_media_path||'')))throw Error('YouTube requires title and uploaded MP4');
 if(c.platform==='x_twitter'&&c.adapted_text.length>280)throw Error('X post exceeds configured 280-character limit');
 if(instagram&&c.adapted_text.length>2200)throw Error('Instagram caption exceeds 2200 characters');
 const settings=youtube?{__type:identifier,title:c.video_title!,type:c.youtube_visibility,selfDeclaredMadeForKids:'no',tags:(c.youtube_tags||[]).map(label=>({label,value:label}))}
  :instagram?{__type:identifier,post_type:c.content_type==='story'?'story':'post'}
  :c.platform==='x_twitter'?{__type:identifier,who_can_reply_post:'everyone'}:{__type:identifier};
 return{type:'now',date:new Date().toISOString(),shortLink:false,tags:[],posts:[{integration:{id:c.postiz_account_id},value:[{content:c.adapted_text,image:media}],settings}]};
}
async function publish(c:Candidate){
 const response=await fetch(`${BASE}/posts`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:KEY,'Idempotency-Key':`${c.platform}:${c.draft_id}:${c.account_id}`},body:JSON.stringify(buildPostizPayload(c)),signal:AbortSignal.timeout(30_000)});
 if(!response.ok)throw new Error(`Postiz HTTP ${response.status}; reconcile before retrying`);return acceptedPostId(await response.json(),c.postiz_account_id);
}
async function finishDraft(client:PoolClient,draftId:string){
 await client.query(`UPDATE social_content_draft d SET status=CASE
 WHEN EXISTS(SELECT 1 FROM social_platform_variant v WHERE v.draft_id=d.id AND v.status='pending') THEN 'approved'
 WHEN EXISTS(SELECT 1 FROM social_platform_variant v WHERE v.draft_id=d.id AND v.status='scheduled') THEN 'publishing'
 WHEN EXISTS(SELECT 1 FROM social_platform_variant v WHERE v.draft_id=d.id AND v.status='failed') THEN 'failed'
 ELSE 'published' END,updated_at=now() WHERE d.id=$1`,[draftId]);
}
async function reconcile(){
 const queued=await db.query(`SELECT p.*,a.postiz_account_id FROM social_post p JOIN social_account a ON a.id=p.account_id WHERE p.status='queued' AND p.postiz_job_id IS NOT NULL ORDER BY p.created_at LIMIT 50`);
 for(const p of queued.rows){
  const params=new URLSearchParams({startDate:new Date(new Date(p.created_at).getTime()-86400000).toISOString(),endDate:new Date(Date.now()+86400000).toISOString()});
  const response=await fetch(`${BASE}/posts?${params}`,{headers:{Authorization:KEY},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Postiz status HTTP ${response.status}`);
  const receipt=publicationReceipt(await response.json(),p.postiz_job_id,p.postiz_account_id);
  if(receipt.status==='queued')continue;
  const client=await db.connect();try{await client.query('BEGIN');
   await client.query(`UPDATE social_post SET status=$2,external_post_url=$3,published_at=CASE WHEN $2='published' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 AND status='queued'`,[p.id,receipt.status,receipt.url||null]);
   await client.query(`UPDATE social_platform_variant SET status=$3,published_at=CASE WHEN $3='published' THEN now() ELSE NULL END,error_message=CASE WHEN $3='failed' THEN 'Postiz reported ERROR' ELSE NULL END WHERE draft_id=$1 AND platform=$2`,[p.draft_id,p.platform,receipt.status]);
   await finishDraft(client,p.draft_id);await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 }
}
export async function run(){
 if(!KEY){console.warn('[postiz-social-auto-publish] blocked: POSTIZ_PUBLIC_API_KEY is missing');return;}
 await reconcile();
 const accountsResponse=await fetch(`${BASE}/integrations`,{headers:{Authorization:KEY},signal:AbortSignal.timeout(15000)});
 if(!accountsResponse.ok)throw Error(`Postiz integrations HTTP ${accountsResponse.status}`);
 const accounts=await accountsResponse.json() as Array<{id:string;identifier:string}>;
 if(!Array.isArray(accounts))throw Error('Unexpected Postiz integrations response');
 for(let n=0;n<10;n++){
  const client=await db.connect();let c:Candidate|null=null;
  try{await client.query('BEGIN');c=await claim(client);
   if(c){await client.query(`INSERT INTO social_post(tenant_id,workspace_id,draft_id,platform,account_id,idempotency_key,scheduled_at,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,'publishing')`,[c.tenant_id,c.workspace_id,c.draft_id,c.platform,c.account_id,`${c.platform}:${c.draft_id}:${c.account_id}`,c.scheduled_at]);
    await client.query(`UPDATE social_platform_variant SET status='scheduled' WHERE draft_id=$1 AND platform=$2`,[c.draft_id,c.platform]);}
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  if(!c)break;
  const key=`${c.platform}:${c.draft_id}:${c.account_id}`;
  try{
   c.provider_identifier=providerFor(c.platform,accounts.find(a=>a.id===c!.postiz_account_id)?.identifier||'');
   const jobId=await publish(c);
   const saved=await db.connect();try{await saved.query('BEGIN');
    await saved.query(`UPDATE social_post SET status='queued',postiz_job_id=$2,updated_at=now() WHERE idempotency_key=$1`,[key,jobId]);
    await finishDraft(saved,c.draft_id);await saved.query('COMMIT');
   }catch(e){await saved.query('ROLLBACK');throw e}finally{saved.release()}
  }catch(e){
   // A timeout may follow a successful remote acceptance. Never automatically resubmit.
   const failed=await db.connect();try{await failed.query('BEGIN');
    await failed.query(`UPDATE social_post SET status='paused',failure_reason='Submission uncertain or invalid; reconcile in Postiz before retrying',updated_at=now() WHERE idempotency_key=$1`,[key]);
    await failed.query(`UPDATE social_platform_variant SET status='failed',error_message='Submission needs operator reconciliation; not confirmed published',retry_count=LEAST(retry_count+1,3) WHERE draft_id=$1 AND platform=$2`,[c.draft_id,c.platform]);
    await finishDraft(failed,c.draft_id);await failed.query('COMMIT');
   }catch(err){await failed.query('ROLLBACK');throw err}finally{failed.release()}
   console.error('[postiz-social-auto-publish] submission requires reconciliation');
  }
 }
}
