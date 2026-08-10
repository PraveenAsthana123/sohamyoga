#!/usr/bin/env bash
set -u
ROOT=/mnt/deepa/sohamyoga
source "$HOME/.config/sohamyoga/ports.env"
source "$HOME/.config/sohamyoga/runtime.env"

# Synchronize the complete installed Ollama inventory into model master.
while IFS= read -r model; do
  [[ -n "$model" ]] || continue
  capabilities='{general}'
  [[ "$model" == *coder* || "$model" == *code-* ]] && capabilities='{code,review,test}'
  [[ "$model" == *embed* || "$model" == bge-* ]] && capabilities='{embedding,retrieval}'
  [[ "$model" == *vl* ]] && capabilities='{vision,general}'
  psql "$DATABASE_URL" -X -q -v model="$model" -v caps="$capabilities" <<'SQL'
INSERT INTO ai_model_master(provider,model_name,model_family,capability_codes,local_model,enabled,updated_at)
VALUES('ollama',:'model',split_part(:'model',':',1),:'caps'::text[],TRUE,TRUE,now())
ON CONFLICT(provider,model_name) DO UPDATE SET capability_codes=EXCLUDED.capability_codes,enabled=TRUE,updated_at=now();
SQL
done < <(ollama list | awk 'NR>1{print $1}')

# Discover database objects and their real PK/FK evidence.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
WITH objects AS (
 SELECT t.table_name,
   EXISTS(SELECT 1 FROM information_schema.table_constraints p WHERE p.table_schema='public' AND p.table_name=t.table_name AND p.constraint_type='PRIMARY KEY') has_pk,
   (SELECT count(*) FROM information_schema.table_constraints f WHERE f.table_schema='public' AND f.table_name=t.table_name AND f.constraint_type='FOREIGN KEY')::int fk_count,
   CASE
    WHEN EXISTS(SELECT 1 FROM module_master m WHERE m.module_key=split_part(t.table_name,'_',1)) THEN split_part(t.table_name,'_',1)
    WHEN t.table_name LIKE 'ad_%' THEN 'ads' WHEN t.table_name LIKE 'marketing_%' THEN 'marketing'
    WHEN t.table_name LIKE 'social_%' THEN 'social' WHEN t.table_name LIKE 'mcp_%' THEN 'mcp'
    WHEN t.table_name LIKE 'teacher_%' THEN 'teacher' WHEN t.table_name LIKE 'student_%' THEN 'student'
    WHEN t.table_name LIKE 'wellness_%' THEN 'wellness' WHEN t.table_name LIKE 'yoga_%' THEN 'yoga'
    WHEN t.table_name LIKE 'referral_%' THEN 'referral' WHEN t.table_name LIKE 'survey_%' THEN 'survey'
    WHEN t.table_name LIKE 'product_%' OR t.table_name LIKE 'order_%' OR t.table_name LIKE 'cart_%' THEN 'ecommerce'
    ELSE 'core' END module_key
 FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
)
INSERT INTO module_database_object(module_id,object_name,object_type,has_primary_key,foreign_key_count,discovered_at)
SELECT m.id,o.table_name,'table',o.has_pk,o.fk_count,now() FROM objects o JOIN module_master m USING(module_key)
ON CONFLICT(module_id,schema_name,object_name) DO UPDATE SET has_primary_key=EXCLUDED.has_primary_key,foreign_key_count=EXCLUDED.foreign_key_count,discovered_at=now();
SQL

# Correct heuristic ownership using each domain's authoritative SQL source.
while IFS= read -r schema_file; do
  module=$(basename "$(dirname "$schema_file")")
  while IFS= read -r table; do
    [[ -n "$table" ]] || continue
    psql "$DATABASE_URL" -X -q -v module="$module" -v table="$table" <<'SQL'
UPDATE module_database_object SET module_id=(SELECT id FROM module_master WHERE module_key=:'module')
WHERE object_name=:'table' AND EXISTS(SELECT 1 FROM module_master WHERE module_key=:'module');
SQL
  done < <(sed -nE 's/^[[:space:]]*CREATE TABLE( IF NOT EXISTS)?[[:space:]]+"?([a-zA-Z0-9_]+)"?.*/\2/Ip' "$schema_file")
done < <(find "$ROOT/sohamyoga-frontend/src/domain" -mindepth 2 -maxdepth 2 -name '*.sql' | sort)

test_route() {
 local stakeholder="$1" route="$2" module="$3" started code duration status err=''
 started=$(date +%s%3N)
 if [[ "$route" == *'['* ]]; then code=''; status=blocked; err='Dynamic route requires fixture identifier';
 else code=$(curl -sS --max-time 40 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SOHAM_FRONTEND_PORT$route" 2>/dev/null) || code=000; [[ "$code" =~ ^(2|3) ]] && status=passed || { status=failed; err="HTTP $code"; }; fi
 duration=$(( $(date +%s%3N)-started ))
 psql "$DATABASE_URL" -X -q -v module="$module" -v route="$route" -v stakeholder="$stakeholder" -v status="$status" -v code="${code:-0}" -v duration="$duration" -v err="$err" <<'SQL'
WITH m AS (SELECT id FROM module_master WHERE module_key=:'module'), feature AS (
 INSERT INTO module_feature(module_id,feature_key,name,stakeholder,ui_route)
 SELECT id,md5(:'stakeholder'||':'||:'route'),:'route',:'stakeholder',:'route' FROM m
 ON CONFLICT(module_id,feature_key) DO UPDATE SET ui_route=EXCLUDED.ui_route,enabled=TRUE RETURNING module_id
)
INSERT INTO module_test_run(module_id,test_type,test_name,status,http_status,duration_ms,error_type,error_message,evidence,is_synthetic)
SELECT module_id,'ui_http','Route '||:'route',:'status',NULLIF(:'code','0')::int,:'duration'::bigint,CASE WHEN :'status'='failed' THEN 'HTTP_ERROR' WHEN :'status'='blocked' THEN 'FIXTURE_REQUIRED' END,NULLIF(:'err',''),jsonb_build_object('route',:'route','stakeholder',:'stakeholder'),TRUE FROM feature;
SQL
}

while IFS= read -r file; do
 rel=${file#"$ROOT/sohamyoga-frontend/src/app/"}; route=/${rel%/page.tsx}; [[ "$route" == /page.tsx ]] && route=/
 if [[ "$route" == /admin* ]]; then stakeholder=admin; segment=${route#/admin}; segment=${segment#/}; module=${segment%%/*};
 elif [[ "$route" == /customer* ]]; then stakeholder=customer; module=customer;
 else stakeholder=sales; segment=${route#/}; module=${segment%%/*}; fi
 [[ -n "$module" ]] || module=core
 exists=$(psql "$DATABASE_URL" -Atc "SELECT 1 FROM module_master WHERE module_key='${module//\'/}'")
 [[ "$exists" == 1 ]] || module=core
 test_route "$stakeholder" "$route" "$module"
done < <(find "$ROOT/sohamyoga-frontend/src/app" -name page.tsx -not -path '*/integrations/paperclip/*' | sort)

# Downloaded/configured is distinct from healthy/working.
while IFS= read -r name; do
 psql "$DATABASE_URL" -X -q -v key="$name" <<'SQL'
INSERT INTO integration_master(integration_key,name,install_status,config_status,runtime_status,enabled,requires_credentials,notes)
VALUES(:'key',initcap(replace(:'key','-',' ')),'downloaded','not_verified','stopped',FALSE,TRUE,'Folder present; runtime and credentials must be verified separately')
ON CONFLICT(integration_key) DO UPDATE SET install_status='downloaded',updated_at=now();
SQL
done < <(find "$ROOT/integrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)

for row in "paperclip|http://127.0.0.1:$SOHAM_PAPERCLIP_PORT/api/health" "openclaw|http://127.0.0.1:$SOHAM_OPENCLAW_PORT/" "ollama-director|http://127.0.0.1:$SOHAM_OLLAMA_GATEWAY_PORT/health"; do
 key=${row%%|*}; endpoint=${row#*|}; code=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$endpoint" 2>/dev/null) || code=000; [[ "$code" == 200 ]] && status=working || status=failed
 psql "$DATABASE_URL" -X -q -v key="$key" -v endpoint="$endpoint" -v status="$status" -v code="$code" <<'SQL'
INSERT INTO integration_master(integration_key,name,install_status,config_status,runtime_status,endpoint,enabled,requires_credentials,last_checked_at)
VALUES(:'key',initcap(replace(:'key','-',' ')),'installed','configured',:'status',:'endpoint',TRUE,FALSE,now())
ON CONFLICT(integration_key) DO UPDATE SET install_status='installed',config_status='configured',runtime_status=EXCLUDED.runtime_status,endpoint=EXCLUDED.endpoint,enabled=TRUE,requires_credentials=FALSE,last_checked_at=now(),updated_at=now();
SQL
done

psql "$DATABASE_URL" -X -q <<'SQL'
INSERT INTO synthetic_dataset_run(dataset_name,purpose,status,record_counts,generated_by,expires_at)
SELECT 'Module assurance route checks','Generate module/dashboard assurance reports','completed',
 jsonb_build_object('moduleTests',(SELECT count(*) FROM module_test_run WHERE is_synthetic),'modules',(SELECT count(*) FROM module_master),'integrations',(SELECT count(*) FROM integration_master)),
 'run-module-assurance.sh',now()+interval '30 days';
SQL
echo 'Module assurance scan complete.'
