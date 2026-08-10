import { createHash, randomUUID } from 'crypto';
import { databaseConfigured, query } from './postgres';

type RunStart = { componentKey: string; operationType: string; operationName: string; tenantId?: string | null; organizationId?: string | null; correlationId?: string; actorType?: string; actorId?: string; source?: string; requestSummary?: string; input?: Record<string, unknown> };
type RunHandle = { id: string; traceId: string; startedAt: number };

const safe = (value: unknown) => JSON.stringify(value ?? {}).slice(0, 100_000);
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function startOperation(input: RunStart): Promise<RunHandle> {
  const fallback = { id: randomUUID(), traceId: randomUUID(), startedAt: Date.now() };
  if (!databaseConfigured()) return fallback;
  try {
    const result = await query<{ id: string; trace_id: string }>(`
      INSERT INTO operation_run(tenant_id,organization_id,component_id,trace_id,correlation_id,operation_type,operation_name,status,actor_type,actor_id,source,request_summary,input_metadata,started_at)
      SELECT $1,$2,id,$3,$4,$5,$6,'running',$7,$8,$9,$10,$11::jsonb,now()
      FROM platform_component WHERE component_key=$12 RETURNING operation_run.id,trace_id`,
      [input.tenantId || null,input.organizationId || null,fallback.traceId,input.correlationId || null,input.operationType,input.operationName,input.actorType || null,input.actorId || null,input.source || null,input.requestSummary?.slice(0,2000) || null,safe(input.input),input.componentKey]);
    return { id: result.rows[0]?.id || fallback.id, traceId: result.rows[0]?.trace_id || fallback.traceId, startedAt: Date.now() };
  } catch { return fallback; }
}

export async function finishOperation(run: RunHandle, status: 'succeeded'|'failed'|'timeout'|'blocked', output: Record<string, unknown> = {}) {
  if (!databaseConfigured()) return;
  try { await query(`UPDATE operation_run SET status=$2,output_metadata=$3::jsonb,duration_ms=$4,completed_at=now() WHERE id=$1`,[run.id,status,safe(output),Date.now()-run.startedAt]); } catch { /* observability must not break production work */ }
}

export async function recordEvent(run: RunHandle, eventCode: string, detail: { severity?: string; stage?: string; message: string; tenantId?: string; details?: Record<string,unknown> }) {
  if (!databaseConfigured()) return;
  try { await query(`INSERT INTO operation_event(run_id,tenant_id,severity,event_code,stage,message,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[run.id,detail.tenantId || null,detail.severity || 'info',eventCode,detail.stage || null,detail.message.slice(0,4000),safe(detail.details)]); } catch { /* non-fatal */ }
}

export async function recordError(run: RunHandle, componentKey: string, error: unknown, context: Record<string,unknown> = {}) {
  if (!databaseConfigured()) return;
  const text = message(error).slice(0,4000);
  const fingerprint = createHash('sha256').update(`${componentKey}:${text}`).digest('hex');
  try { await query(`
    INSERT INTO error_occurrence(run_id,component_id,trace_id,error_code,error_type,message,sanitized_stack,fingerprint,retryable,context)
    SELECT $1,id,$2,'UNHANDLED_OPERATION_ERROR',$3,$4,$5,$6,TRUE,$7::jsonb FROM platform_component WHERE component_key=$8
    ON CONFLICT(component_id,fingerprint) DO UPDATE SET occurrence_count=error_occurrence.occurrence_count+1,last_seen_at=now(),run_id=EXCLUDED.run_id,trace_id=EXCLUDED.trace_id,context=EXCLUDED.context`,
    [run.id,run.traceId,error instanceof Error ? error.name : 'Error',text,error instanceof Error ? error.stack?.slice(0,12000) : null,fingerprint,safe(context),componentKey]); } catch { /* non-fatal */ }
}

export async function recordCircuit(componentKey: string, circuitKey: string, success: boolean, failureThreshold=3, recoverySeconds=30) {
  if (!databaseConfigured()) return;
  try { await query(`
    INSERT INTO circuit_breaker_state(component_id,circuit_key,state,failure_count,success_count,failure_threshold,recovery_timeout_seconds,last_success_at,last_failure_at)
    SELECT id,$2,CASE WHEN $3 THEN 'closed' ELSE 'closed' END,CASE WHEN $3 THEN 0 ELSE 1 END,CASE WHEN $3 THEN 1 ELSE 0 END,$4,$5,CASE WHEN $3 THEN now() END,CASE WHEN NOT $3 THEN now() END FROM platform_component WHERE component_key=$1
    ON CONFLICT(tenant_id,component_id,circuit_key) DO UPDATE SET
      failure_count=CASE WHEN $3 THEN 0 ELSE circuit_breaker_state.failure_count+1 END,
      success_count=CASE WHEN $3 THEN circuit_breaker_state.success_count+1 ELSE circuit_breaker_state.success_count END,
      state=CASE WHEN NOT $3 AND circuit_breaker_state.failure_count+1 >= circuit_breaker_state.failure_threshold THEN 'open' ELSE CASE WHEN $3 THEN 'closed' ELSE circuit_breaker_state.state END END,
      opened_at=CASE WHEN NOT $3 AND circuit_breaker_state.failure_count+1 >= circuit_breaker_state.failure_threshold THEN now() ELSE circuit_breaker_state.opened_at END,
      next_attempt_at=CASE WHEN NOT $3 AND circuit_breaker_state.failure_count+1 >= circuit_breaker_state.failure_threshold THEN now()+make_interval(secs=>$5) ELSE circuit_breaker_state.next_attempt_at END,
      last_success_at=CASE WHEN $3 THEN now() ELSE circuit_breaker_state.last_success_at END,last_failure_at=CASE WHEN NOT $3 THEN now() ELSE circuit_breaker_state.last_failure_at END,updated_at=now()`,
    [componentKey,circuitKey,success,failureThreshold,recoverySeconds]); } catch { /* non-fatal */ }
}

export async function recordModelInvocation(run: RunHandle, modelName: string, input: { status: 'succeeded'|'failed'|'timeout'; purpose?: string; promptChars?: number; outputChars?: number; latencyMs?: number }) {
  if (!databaseConfigured()) return;
  try { await query(`
    WITH model AS (
      INSERT INTO ai_model_master(provider,model_name,capability_codes,local_model)
      VALUES('ollama',$2,ARRAY[$3],TRUE) ON CONFLICT(provider,model_name) DO UPDATE SET updated_at=now()
      RETURNING id
    )
    INSERT INTO model_invocation(run_id,model_id,purpose,prompt_chars,latency_ms,status,metadata)
    SELECT $1,id,$3,$4,$5,$6,$7::jsonb FROM model`,
    [run.id,modelName,input.purpose || 'general',input.promptChars || 0,input.latencyMs || null,input.status,safe({ outputChars: input.outputChars || 0 })]); } catch { /* non-fatal */ }
}
