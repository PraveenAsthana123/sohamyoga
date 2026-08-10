import {NextRequest} from 'next/server'; import {databaseConfigured,query} from '@/lib/postgres'; import {requireAdmin} from '@/lib/admin-auth';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;if(!databaseConfigured())return Response.json({error:'DATABASE_URL missing'},{status:503});
 const [modules,integrations,tests,components,models,synthetic,errors,features,testFailures]=await Promise.all([
  query('SELECT * FROM v_module_assurance ORDER BY category,name'),query('SELECT * FROM integration_master ORDER BY runtime_status DESC,name'),
  query("SELECT status,test_type,count(*)::int count FROM module_test_run GROUP BY status,test_type ORDER BY status,test_type"),
  query('SELECT component_key,name,runtime,component_type,enabled FROM platform_component ORDER BY runtime,component_key'),
  query("SELECT m.model_name,m.provider,m.capability_codes,m.enabled,count(i.id)::int invocations,max(i.created_at) last_used_at FROM ai_model_master m LEFT JOIN model_invocation i ON i.model_id=m.id GROUP BY m.id ORDER BY invocations DESC,m.model_name"),
  query('SELECT * FROM synthetic_dataset_run ORDER BY created_at DESC LIMIT 20'),
  query('SELECT component_key,error_code,severity,message,occurrence_count,last_seen_at FROM v_open_platform_errors LIMIT 100'),query('SELECT * FROM v_stakeholder_features'),query("SELECT m.module_key,t.test_type,t.test_name,t.status,t.http_status,t.error_type,t.error_message,t.run_at FROM module_test_run t JOIN module_master m ON m.id=t.module_id WHERE t.status IN('failed','blocked') ORDER BY t.run_at DESC LIMIT 200")]);
 return Response.json({modules:modules.rows,integrations:integrations.rows,tests:tests.rows,components:components.rows,models:models.rows,synthetic:synthetic.rows,errors:errors.rows,features:features.rows,testFailures:testFailures.rows});}
export async function PUT(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;const b=await req.json().catch(()=>null) as {moduleKey?:string;enabled?:boolean}|null;if(!b?.moduleKey||typeof b.enabled!=='boolean')return Response.json({error:'moduleKey and enabled required'},{status:400});
 const result=await query('UPDATE module_master SET enabled=$2,updated_at=now() WHERE module_key=$1 RETURNING module_key,enabled',[b.moduleKey,b.enabled]);if(!result.rowCount)return Response.json({error:'Module not found'},{status:404});return Response.json(result.rows[0]);}
