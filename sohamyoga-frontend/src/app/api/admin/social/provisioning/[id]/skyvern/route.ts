import {NextRequest} from 'next/server';
import {getAdminPrincipal} from '@/lib/admin-auth';
import {query,transaction} from '@/lib/postgres';
import {getSkyvernRun,provisioningPrompt,startSkyvernTask} from '@/lib/skyvern';
const ALLOWED_STATES=new Set(['VALIDATION_PASSED','SIGNUP_STARTED','ACCOUNT_CREATED','DEVELOPER_APP_PENDING','REVIEW_REQUIRED']);
export const runtime='nodejs';

export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;
 const found=await query(`SELECT j.*,r.developer_portal_url,r.developer_creation_mode FROM account_provisioning_job j JOIN social_platform_requirement r ON r.platform=j.platform WHERE j.id=$1`,[params.id]);
 if(!found.rowCount)return Response.json({error:'Provisioning job not found.'},{status:404});const job=found.rows[0];
 if(!ALLOWED_STATES.has(job.state))return Response.json({error:`Skyvern cannot start from ${job.state}. Approve and validate the profile first.`},{status:409});
 if(!['ASSISTED_BROWSER','PARTNER_PROVISIONING_API'].includes(job.developer_creation_mode))return Response.json({error:`${job.platform} is classified ${job.developer_creation_mode} — browser automation is not permitted here. This platform's own policy requires a human to complete setup directly.`},{status:409});
 if(!job.developer_portal_url)return Response.json({error:'This platform has no approved developer portal URL.'},{status:409});
 try{
  const run=await startSkyvernTask(job.developer_portal_url,provisioningPrompt(job.platform,job.account_name));
  await transaction(async client=>{
   await client.query(`INSERT INTO provisioning_browser_run(job_id,tenant_id,external_run_id,external_browser_session_id,start_url,status,app_url,started_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[job.id,job.tenant_id,run.run_id,run.browser_session_id||null,job.developer_portal_url,run.status,run.app_url||null,auth.principal!.id]);
   await client.query(`INSERT INTO social_provisioning_event(job_id,tenant_id,platform,actor_type,actor_id,action,before_state,after_state,result,metadata) VALUES($1,$2,$3,'API',$4,'BROWSER_RUN_STARTED',$5,$5,'pending',jsonb_build_object('provider','skyvern','run_id',$6))`,[job.id,job.tenant_id,job.platform,auth.principal!.id,job.state,run.run_id]);
  });return Response.json({run},{status:202});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Skyvern start failed.'},{status:503})}
}

export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;
 const stored=await query(`SELECT * FROM provisioning_browser_run WHERE job_id=$1 ORDER BY started_at DESC LIMIT 1`,[params.id]);
 if(!stored.rowCount)return Response.json({error:'No browser run exists for this job.'},{status:404});
 try{const run=await getSkyvernRun(stored.rows[0].external_run_id);await query(`UPDATE provisioning_browser_run SET status=$2,app_url=COALESCE($3,app_url),failure_reason=$4,finished_at=$5,last_synced_at=now() WHERE id=$1`,[stored.rows[0].id,run.status,run.app_url||null,run.failure_reason||null,run.finished_at||null]);return Response.json({run})}
 catch(error){return Response.json({run:stored.rows[0],stale:true,error:error instanceof Error?error.message:'Skyvern status unavailable.'},{status:502})}
}

