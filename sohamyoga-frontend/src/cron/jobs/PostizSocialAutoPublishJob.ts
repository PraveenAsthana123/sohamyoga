// Publishes independently approved Facebook and LinkedIn variants through Postiz.
// The master draft completes only after every variant has reached a terminal state.
import{Pool,type PoolClient}from'pg';
const db=new Pool({connectionString:process.env.DATABASE_URL});
const BASE=process.env.POSTIZ_PUBLIC_API_BASE||'http://127.0.0.1:15081/public/v1';
const KEY=process.env.POSTIZ_PUBLIC_API_KEY||'';
export const AUTOMATED_POSTIZ_PLATFORMS=['facebook','linkedin','youtube']as const;
type Platform=typeof AUTOMATED_POSTIZ_PLATFORMS[number];
type Candidate={draft_id:string;tenant_id:string;workspace_id:string;adapted_text:string;account_id:string;postiz_account_id:string;scheduled_at:string;platform:Platform;video_title:string|null;postiz_media_id:string|null;postiz_media_path:string|null;youtube_visibility:'public'|'private'|'unlisted';youtube_tags:string[]};

export function automationPrerequisites(count:number,key:string){
 if(!key)return{ready:false,reason:'POSTIZ_PUBLIC_API_KEY is missing'};
 if(!count)return{ready:false,reason:'no approved due Facebook, LinkedIn, or upload-ready YouTube variant with a connected Postiz account'};
 return{ready:true,reason:'ready'};
}
async function claim(client:PoolClient):Promise<Candidate|null>{
 const selected=await client.query<Candidate>(`SELECT d.id draft_id,d.tenant_id,d.workspace_id,COALESCE(NULLIF(v.adapted_text,''),d.master_text) adapted_text,a.id account_id,a.postiz_account_id,COALESCE(v.scheduled_at,d.default_schedule_at) scheduled_at,v.platform,v.video_title,v.postiz_media_id,v.postiz_media_path,v.youtube_visibility,v.youtube_tags
 FROM social_content_draft d JOIN social_platform_variant v ON v.draft_id=d.id AND v.platform=ANY($1) AND v.status='pending'
 JOIN social_account a ON a.id=v.account_id AND a.platform=v.platform AND a.status='connected'
 WHERE d.status='approved' AND d.reviewed_by IS NOT NULL AND d.reviewed_at IS NOT NULL AND a.postiz_account_id IS NOT NULL
 AND (v.platform<>'youtube' OR (v.video_title IS NOT NULL AND char_length(v.video_title) BETWEEN 2 AND 100 AND v.postiz_media_id IS NOT NULL AND v.postiz_media_path~*'\\.mp4([?#].*)?$'))
 AND COALESCE(v.scheduled_at,d.default_schedule_at)<=now() ORDER BY COALESCE(v.scheduled_at,d.default_schedule_at),d.created_at
 FOR UPDATE OF d,v SKIP LOCKED LIMIT 1`,[AUTOMATED_POSTIZ_PLATFORMS]);
 if(!selected.rowCount)return null;
 await client.query(`UPDATE social_content_draft SET status='publishing',updated_at=now() WHERE id=$1`,[selected.rows[0].draft_id]);return selected.rows[0];
}
export function buildPostizPayload(c:Candidate){const youtube=c.platform==='youtube';return{type:'now',date:new Date().toISOString(),shortLink:false,tags:[],posts:[{integration:{id:c.postiz_account_id},value:[{content:c.adapted_text,image:youtube?[{id:c.postiz_media_id!,path:c.postiz_media_path!}]:[]}],...(youtube?{settings:{__type:'youtube',title:c.video_title!,type:c.youtube_visibility,selfDeclaredMadeForKids:'no',tags:(c.youtube_tags||[]).map(label=>({label,value:label}))}}:{})}]};}
async function publish(c:Candidate){
 const response=await fetch(`${BASE}/posts`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:KEY,'Idempotency-Key':`${c.platform}:${c.draft_id}:${c.account_id}`},body:JSON.stringify(buildPostizPayload(c)),signal:AbortSignal.timeout(30_000)});
 const text=await response.text();if(!response.ok)throw new Error(`Postiz HTTP ${response.status}: ${text.slice(0,300)}`);return text?JSON.parse(text)as Record<string,unknown>:{};
}
export async function run(){
 if(!KEY){console.warn('[postiz-social-auto-publish] blocked: POSTIZ_PUBLIC_API_KEY is missing');return}let published=0;
 for(let n=0;n<10;n++){
  const client=await db.connect();let c:Candidate|null=null;try{await client.query('BEGIN');c=await claim(client);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}if(!c)break;
  const key=`${c.platform}:${c.draft_id}:${c.account_id}`;
  try{const result=await publish(c);const externalId=typeof result.id==='string'?result.id:null;const success=await db.connect();try{await success.query('BEGIN');
   await success.query(`INSERT INTO social_post(tenant_id,workspace_id,draft_id,platform,account_id,idempotency_key,scheduled_at,published_at,status,external_post_id) VALUES($1,$2,$3,$4,$5,$6,$7,now(),'published',$8) ON CONFLICT(idempotency_key) DO NOTHING`,[c.tenant_id,c.workspace_id,c.draft_id,c.platform,c.account_id,key,c.scheduled_at,externalId]);
   await success.query(`UPDATE social_platform_variant SET status='published',platform_post_id=COALESCE($3,platform_post_id),published_at=now(),error_message=NULL WHERE draft_id=$1 AND platform=$2`,[c.draft_id,c.platform,externalId]);
   await success.query(`UPDATE social_content_draft d SET status=CASE WHEN EXISTS(SELECT 1 FROM social_platform_variant v WHERE v.draft_id=d.id AND v.status IN('pending','scheduled')) THEN 'approved' ELSE 'published' END,updated_at=now() WHERE d.id=$1`,[c.draft_id]);await success.query('COMMIT');published++}catch(e){await success.query('ROLLBACK');throw e}finally{success.release()}
  }catch(e){await db.query(`UPDATE social_content_draft SET status='approved',updated_at=now() WHERE id=$1`,[c.draft_id]);await db.query(`UPDATE social_platform_variant SET error_message=$3,retry_count=LEAST(retry_count+1,3) WHERE draft_id=$1 AND platform=$2`,[c.draft_id,c.platform,e instanceof Error?e.message.slice(0,500):'Unknown Postiz error']);console.error(`[postiz-social-auto-publish] platform=${c.platform} draft=${c.draft_id} failed`,e);break}
 }
 console.log(`[postiz-social-auto-publish] published=${published}`);
}
