import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';
import { HUMAN_TASK_TYPES } from '@/domain/social/provisioning';

export async function POST(req:NextRequest,{params}:{params:{id:string}}){
  const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;
  const body=await req.json().catch(()=>({})) as {taskType?:string;instructions?:string;dueAt?:string};
  if(!HUMAN_TASK_TYPES.includes(body.taskType as never)||!body.instructions?.trim())return Response.json({error:'Valid taskType and instructions are required. Never submit an OTP, password, or recovery code.'},{status:400});
  const job=await query(`SELECT id,tenant_id,platform FROM account_provisioning_job WHERE id=$1`,[params.id]);
  if(!job.rowCount)return Response.json({error:'Provisioning job not found.'},{status:404});
  const task=await query(`INSERT INTO provisioning_human_task(job_id,tenant_id,platform,task_type,instructions,due_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[params.id,job.rows[0].tenant_id,job.rows[0].platform,body.taskType,body.instructions.trim(),body.dueAt||null]);
  await query(`INSERT INTO social_provisioning_event(job_id,tenant_id,platform,actor_type,actor_id,action,before_state,after_state,result,metadata) VALUES($1,$2,$3,'HUMAN',$4,'HUMAN_ACTION_REQUIRED',NULL,NULL,'pending',jsonb_build_object('task_type',$5))`,[params.id,job.rows[0].tenant_id,job.rows[0].platform,auth.principal!.id,body.taskType]);
  return Response.json({task:task.rows[0]},{status:201});
}

