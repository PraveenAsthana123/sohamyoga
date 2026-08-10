DROP VIEW IF EXISTS v_module_assurance;
CREATE VIEW v_module_assurance AS
SELECT m.id,m.module_key,m.name,m.category,m.runtime_language,m.enabled,m.lifecycle_status,
 coalesce(f.features,0) features,coalesce(d.database_objects,0) database_objects,
 coalesce(d.objects_with_pk,0) objects_with_pk,coalesce(d.foreign_keys,0) foreign_keys,
 coalesce(t.passed_tests,0) passed_tests,coalesce(t.failed_tests,0) failed_tests,
 coalesce(t.blocked_tests,0) blocked_tests,t.last_tested_at
FROM module_master m
LEFT JOIN LATERAL(SELECT count(*)::int features FROM module_feature WHERE module_id=m.id)f ON TRUE
LEFT JOIN LATERAL(SELECT count(*)::int database_objects,count(*)FILTER(WHERE has_primary_key)::int objects_with_pk,coalesce(sum(foreign_key_count),0)::int foreign_keys FROM module_database_object WHERE module_id=m.id)d ON TRUE
LEFT JOIN LATERAL(SELECT count(*)FILTER(WHERE status='passed')::int passed_tests,count(*)FILTER(WHERE status='failed')::int failed_tests,count(*)FILTER(WHERE status='blocked')::int blocked_tests,max(run_at)last_tested_at FROM module_test_run WHERE module_id=m.id)t ON TRUE;

CREATE OR REPLACE VIEW v_stakeholder_features AS
SELECT f.stakeholder,m.module_key,m.name module_name,f.feature_key,f.name feature_name,f.ui_route,f.api_route,f.enabled
FROM module_feature f JOIN module_master m ON m.id=f.module_id ORDER BY f.stakeholder,m.name,f.name;
