import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { transaction } from '@/lib/postgres';
import { canTransition, PROVISIONING_STATES, type ProvisioningState } from '@/domain/social/provisioning';

export const runtime = 'nodejs';

export async function PATCH(req:NextRequest,{params}:{params:{id:string}}) {
  const auth=await getAdminPrincipal(req); if(auth.denied)return auth.denied;
  const body=await req.json().catch(()=>({})) as {state?:string;currentStep?:string};
  if(!PROVISIONING_STATES.includes(body.state as ProvisioningState))return Response.json({error:'Invalid provisioning state.'},{status:400});
  const result=await transaction(async client=>{
    const current=await client.query(`SELECT * FROM account_provisioning_job WHERE id=$1 FOR UPDATE`,[params.id]);
    if(!current.rowCount)return null;
    const from=current.rows[0].state as ProvisioningState, to=body.state as ProvisioningState;
    if(!canTransition(from,to))return {invalid:true,from,to};
    const updated=await client.query(`UPDATE account_provisioning_job SET state=$2,current_step=COALESCE($3,current_step),version=version+1,updated_at=now(),completed_at=CASE WHEN $2='ACTIVE' THEN now() ELSE completed_at END WHERE id=$1 RETURNING *`,[params.id,to,body.currentStep||null]);
    await client.query(`INSERT INTO social_provisioning_event(job_id,tenant_id,platform,actor_type,actor_id,action,before_state,after_state,result) VALUES($1,$2,$3,'HUMAN',$4,'STATE_TRANSITION',$5,$6,'success')`,[params.id,current.rows[0].tenant_id,current.rows[0].platform,auth.principal!.id,from,to]);
    return {job:updated.rows[0]};
  });
  if(!result)return Response.json({error:'Provisioning job not found.'},{status:404});
  if('invalid' in result)return Response.json({error:`Transition ${result.from} → ${result.to} is not allowed.`},{status:409});
  return Response.json(result);
}

