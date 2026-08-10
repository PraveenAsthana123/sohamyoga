import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime='nodejs'; export const dynamic='force-dynamic';

export async function GET(req: NextRequest) {
  const denied=await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({error:'DATABASE_URL is not configured.'},{status:503});
  const tenant=req.nextUrl.searchParams.get('tenantId');
  const limit=Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')||100),1),500);
  const filter=tenant ? 'WHERE r.tenant_id=$1' : '';
  const values=tenant ? [tenant,limit] : [limit]; const li=tenant ? '$2' : '$1';
  const [runs,errors,circuits,models,summary]=await Promise.all([
    query(`SELECT r.id,r.trace_id,r.operation_type,r.operation_name,r.status,r.duration_ms,r.created_at,c.component_key FROM operation_run r JOIN platform_component c ON c.id=r.component_id ${filter} ORDER BY r.created_at DESC LIMIT ${li}`,values),
    query(`SELECT e.id,e.trace_id,e.error_code,e.message,e.severity,e.occurrence_count,e.resolved,e.last_seen_at,c.component_key FROM error_occurrence e JOIN platform_component c ON c.id=e.component_id ${tenant?'WHERE e.tenant_id=$1':''} ORDER BY e.last_seen_at DESC LIMIT 100`,tenant?[tenant]:[]),
    query(`SELECT s.circuit_key,s.state,s.failure_count,s.success_count,s.opened_at,s.next_attempt_at,s.updated_at,c.component_key FROM circuit_breaker_state s JOIN platform_component c ON c.id=s.component_id ${tenant?'WHERE s.tenant_id=$1 OR s.tenant_id IS NULL':''} ORDER BY s.updated_at DESC`,tenant?[tenant]:[]),
    query(`SELECT m.model_name,m.provider,count(i.id)::int calls,count(i.id) FILTER(WHERE i.status='failed')::int failures,round(avg(i.latency_ms),2) avg_latency_ms,max(i.created_at) last_called_at FROM ai_model_master m LEFT JOIN model_invocation i ON i.model_id=m.id ${tenant?'AND (i.tenant_id=$1 OR i.tenant_id IS NULL)':''} GROUP BY m.id ORDER BY calls DESC`,tenant?[tenant]:[]),
    query(`SELECT count(*)::int total_runs,count(*) FILTER(WHERE status='succeeded')::int succeeded,count(*) FILTER(WHERE status IN('failed','timeout','blocked'))::int failed,round(avg(duration_ms),2) avg_duration_ms FROM operation_run r ${filter}`,tenant?[tenant]:[]),
  ]);
  return Response.json({summary:summary.rows[0],runs:runs.rows,errors:errors.rows,circuits:circuits.rows,models:models.rows});
}
