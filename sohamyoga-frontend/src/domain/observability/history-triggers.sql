-- Database-level history catches changes from every language and admin tool.

CREATE OR REPLACE FUNCTION record_circuit_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.state IS DISTINCT FROM NEW.state THEN
    INSERT INTO circuit_breaker_transition(circuit_id,from_state,to_state,reason,failure_count)
    VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.state END,NEW.state,
      CASE WHEN TG_OP='INSERT' THEN 'circuit registered' ELSE 'automatic state change' END,NEW.failure_count);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_circuit_transition ON circuit_breaker_state;
CREATE TRIGGER trg_circuit_transition AFTER INSERT OR UPDATE OF state ON circuit_breaker_state
FOR EACH ROW EXECUTE FUNCTION record_circuit_transition();

CREATE OR REPLACE FUNCTION record_master_data_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_json JSONB; new_json JSONB; tenant UUID; org UUID; key TEXT; changed TEXT[];
BEGIN
  old_json:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  new_json:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  tenant:=COALESCE((new_json->>'tenant_id')::uuid,(old_json->>'tenant_id')::uuid);
  org:=COALESCE((new_json->>'organization_id')::uuid,(new_json->>'org_id')::uuid,(old_json->>'organization_id')::uuid,(old_json->>'org_id')::uuid);
  key:=COALESCE(new_json->>'id',old_json->>'id',new_json->>'code',old_json->>'code','unknown');
  IF TG_OP='UPDATE' THEN SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(new_json) k WHERE new_json->k IS DISTINCT FROM old_json->k; ELSE changed:=ARRAY[]::text[]; END IF;
  INSERT INTO data_change_history(tenant_id,organization_id,table_name,record_key,action,actor_type,changed_fields,before_data,after_data)
  VALUES(tenant,org,TG_TABLE_NAME,key,lower(TG_OP),'database_trigger',COALESCE(changed,ARRAY[]::text[]),old_json,new_json);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
EXCEPTION WHEN invalid_text_representation THEN
  INSERT INTO data_change_history(table_name,record_key,action,actor_type,changed_fields,before_data,after_data)
  VALUES(TG_TABLE_NAME,key,lower(TG_OP),'database_trigger',COALESCE(changed,ARRAY[]::text[]),old_json,new_json);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenant','organization','app_user','tenant_ai_model','ai_model_master','service_master','business_condition_master','text_asset_master','product_master','platform_component'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_history_%I ON %I',tbl,tbl);
    EXECUTE format('CREATE TRIGGER trg_history_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_master_data_change()',tbl,tbl);
  END LOOP;
END $$;
