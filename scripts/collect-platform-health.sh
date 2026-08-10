#!/usr/bin/env bash
set -u
source "$HOME/.config/sohamyoga/ports.env"
source "$HOME/.config/sohamyoga/runtime.env"

record() {
  local component="$1" circuit="$2" target="$3" started code status duration
  started=$(date +%s%3N)
  code=$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$target" 2>/dev/null) || code=000
  duration=$(( $(date +%s%3N) - started ))
  if [[ "$code" =~ ^2 ]]; then status=succeeded; else status=failed; fi
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q \
    -v component="$component" -v circuit="$circuit" -v target="$target" \
    -v status="$status" -v response_code="$code" -v duration="$duration" <<'SQL'
WITH component AS (SELECT id FROM platform_component WHERE component_key=:'component'),
run AS (
  INSERT INTO operation_run(component_id,operation_type,operation_name,status,source,input_metadata,output_metadata,started_at,completed_at,duration_ms)
  SELECT id,'health_check',:'circuit' || ' health',:'status','systemd-timer',jsonb_build_object('url',:'target'),jsonb_build_object('httpStatus',:'response_code'),now(),now(),:'duration'::bigint FROM component RETURNING id,trace_id,component_id
), circuit AS (
  INSERT INTO circuit_breaker_state(component_id,circuit_key,state,failure_count,success_count,last_success_at,last_failure_at)
  SELECT component_id,:'circuit',CASE WHEN :'status'='succeeded' THEN 'closed' ELSE 'closed' END,CASE WHEN :'status'='failed' THEN 1 ELSE 0 END,CASE WHEN :'status'='succeeded' THEN 1 ELSE 0 END,CASE WHEN :'status'='succeeded' THEN now() END,CASE WHEN :'status'='failed' THEN now() END FROM run
  ON CONFLICT(tenant_id,component_id,circuit_key) DO UPDATE SET
    failure_count=CASE WHEN :'status'='succeeded' THEN 0 ELSE circuit_breaker_state.failure_count+1 END,
    success_count=CASE WHEN :'status'='succeeded' THEN circuit_breaker_state.success_count+1 ELSE circuit_breaker_state.success_count END,
    state=CASE WHEN :'status'='failed' AND circuit_breaker_state.failure_count+1>=circuit_breaker_state.failure_threshold THEN 'open' ELSE CASE WHEN :'status'='succeeded' THEN 'closed' ELSE circuit_breaker_state.state END END,
    opened_at=CASE WHEN :'status'='failed' AND circuit_breaker_state.failure_count+1>=circuit_breaker_state.failure_threshold THEN now() ELSE circuit_breaker_state.opened_at END,
    next_attempt_at=CASE WHEN :'status'='failed' AND circuit_breaker_state.failure_count+1>=circuit_breaker_state.failure_threshold THEN now()+make_interval(secs=>circuit_breaker_state.recovery_timeout_seconds) ELSE circuit_breaker_state.next_attempt_at END,
    last_success_at=CASE WHEN :'status'='succeeded' THEN now() ELSE circuit_breaker_state.last_success_at END,
    last_failure_at=CASE WHEN :'status'='failed' THEN now() ELSE circuit_breaker_state.last_failure_at END,updated_at=now()
  RETURNING id
)
INSERT INTO operation_event(run_id,severity,event_code,stage,message,details)
SELECT run.id,CASE WHEN :'status'='succeeded' THEN 'info' ELSE 'error' END,'SERVICE_HEALTH_CHECK','health',:'component' || ' returned HTTP ' || :'response_code',jsonb_build_object('url',:'target','durationMs',:'duration'::bigint) FROM run;
SQL
}

record soham-next frontend "http://127.0.0.1:$SOHAM_FRONTEND_PORT/admin/operations-center"
record soham-dotnet backend "http://127.0.0.1:$SOHAM_BACKEND_PORT/api/health"
record paperclip paperclip "http://127.0.0.1:$SOHAM_PAPERCLIP_PORT/api/health"
record openclaw openclaw "http://127.0.0.1:$SOHAM_OPENCLAW_PORT/"
record ollama-director ollama-director "http://127.0.0.1:$SOHAM_OLLAMA_GATEWAY_PORT/health"
