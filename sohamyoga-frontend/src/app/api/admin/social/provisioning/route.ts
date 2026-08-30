import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({error:'DATABASE_URL is not configured.'},{status:503});
  const [jobs,tasks,requirements] = await Promise.all([
    query(`SELECT j.*, count(t.id) FILTER (WHERE t.status='open')::int AS open_tasks FROM account_provisioning_job j LEFT JOIN provisioning_human_task t ON t.job_id=j.id GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 100`),
    query(`SELECT t.*,j.account_name FROM provisioning_human_task t JOIN account_provisioning_job j ON j.id=t.job_id WHERE t.status='open' ORDER BY t.due_at NULLS LAST,t.created_at`),
    query(`SELECT * FROM social_platform_requirement ORDER BY platform`),
  ]);
  return Response.json({jobs:jobs.rows,humanTasks:tasks.rows,requirements:requirements.rows});
}

export async function POST(req: NextRequest) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({error:'DATABASE_URL is not configured.'},{status:503});
  const body = await req.json().catch(()=>({})) as {tenantId?:string;platform?:string;accountName?:string};
  const requirement = body.platform
    ? await query<{platform:string}>(`SELECT platform FROM social_platform_requirement WHERE platform=$1`,[body.platform])
    : {rows:[]};
  if (!requirement.rows.length) return Response.json({error:'Select a registered provisioning platform.'},{status:400});
  const accountName = body.accountName?.trim();
  if (!accountName) return Response.json({error:'accountName is required.'},{status:400});
  const tenantId = body.tenantId || (await query<{id:string}>(`SELECT id FROM tenant ORDER BY created_at LIMIT 1`)).rows[0]?.id;
  if (!tenantId) return Response.json({error:'No tenant exists; create the business tenant first.'},{status:409});
  const job = await transaction(async client => {
    const inserted = await client.query(`INSERT INTO account_provisioning_job(tenant_id,platform,account_name,created_by) VALUES($1,$2,$3,$4) RETURNING *`,[tenantId,body.platform,accountName,auth.principal!.id]);
    await client.query(`INSERT INTO social_provisioning_event(job_id,tenant_id,platform,actor_type,actor_id,action,after_state,result) VALUES($1,$2,$3,'HUMAN',$4,'JOB_CREATED','DRAFT','success')`,[inserted.rows[0].id,tenantId,body.platform,auth.principal!.id]);
    return inserted.rows[0];
  });
  return Response.json({job},{status:201});
}
