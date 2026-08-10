CREATE TABLE IF NOT EXISTS module_master (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_key VARCHAR(80) NOT NULL UNIQUE,
 name VARCHAR(160) NOT NULL, category VARCHAR(50) NOT NULL, runtime_language VARCHAR(40),
 enabled BOOLEAN NOT NULL DEFAULT TRUE, lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'configured',
 description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS module_feature (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID NOT NULL REFERENCES module_master(id) ON DELETE CASCADE,
 feature_key VARCHAR(120) NOT NULL, name VARCHAR(200) NOT NULL, stakeholder VARCHAR(40) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE, ui_route TEXT, api_route TEXT, service_key VARCHAR(100),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(module_id,feature_key)
);
CREATE TABLE IF NOT EXISTS module_user_flow (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID NOT NULL REFERENCES module_master(id) ON DELETE CASCADE,
 flow_key VARCHAR(120) NOT NULL, stakeholder VARCHAR(40) NOT NULL, name VARCHAR(200) NOT NULL,
 steps JSONB NOT NULL DEFAULT '[]', status VARCHAR(30) NOT NULL DEFAULT 'documented',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(module_id,flow_key)
);
CREATE TABLE IF NOT EXISTS module_database_object (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID NOT NULL REFERENCES module_master(id) ON DELETE CASCADE,
 schema_name VARCHAR(80) NOT NULL DEFAULT 'public', object_name VARCHAR(160) NOT NULL,
 object_type VARCHAR(30) NOT NULL, has_primary_key BOOLEAN, foreign_key_count INTEGER NOT NULL DEFAULT 0,
 discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(module_id,schema_name,object_name)
);
CREATE TABLE IF NOT EXISTS integration_master (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), integration_key VARCHAR(100) NOT NULL UNIQUE,
 name VARCHAR(180) NOT NULL, install_status VARCHAR(30) NOT NULL, config_status VARCHAR(30) NOT NULL,
 runtime_status VARCHAR(30) NOT NULL, endpoint TEXT, component_id UUID REFERENCES platform_component(id) ON DELETE SET NULL,
 enabled BOOLEAN NOT NULL DEFAULT FALSE, requires_credentials BOOLEAN NOT NULL DEFAULT TRUE,
 last_checked_at TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS module_test_run (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID REFERENCES module_master(id) ON DELETE CASCADE,
 integration_id UUID REFERENCES integration_master(id) ON DELETE CASCADE,
 test_type VARCHAR(50) NOT NULL, test_name VARCHAR(240) NOT NULL, status VARCHAR(20) NOT NULL CHECK(status IN('passed','failed','blocked','skipped')),
 http_status INTEGER, duration_ms BIGINT, error_type VARCHAR(80), error_message TEXT,
 evidence JSONB NOT NULL DEFAULT '{}', is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
 run_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK((module_id IS NOT NULL)::int+(integration_id IS NOT NULL)::int=1)
);
CREATE INDEX IF NOT EXISTS idx_module_test_latest ON module_test_run(module_id,run_at DESC);
CREATE TABLE IF NOT EXISTS synthetic_dataset_run (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
 dataset_name VARCHAR(180) NOT NULL, purpose TEXT NOT NULL, status VARCHAR(24) NOT NULL,
 record_counts JSONB NOT NULL DEFAULT '{}', tag VARCHAR(40) NOT NULL DEFAULT 'SYNTHETIC_DATA',
 generated_by VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ
);

INSERT INTO module_master(module_key,name,category,runtime_language) VALUES
('ads','Advertising','marketing','typescript'),('analytics','Analytics','platform','typescript'),('banner','Banner Studio','marketing','typescript'),
('booking','Booking','commerce','typescript'),('campaign','Campaigns','marketing','typescript'),('carousel','Carousels','content','typescript'),
('chat','Chat','communication','typescript'),('community','Community','engagement','typescript'),('core','Core/Tenant','platform','sql'),
('coupon','Coupons','commerce','typescript'),('customer','Customer','identity','typescript'),('documents','Documents','content','typescript'),
('ecommerce','E-commerce','commerce','typescript'),('enterprise','Enterprise','organization','typescript'),('features','Feature Controls','platform','typescript'),
('gamification','Gamification','engagement','typescript'),('hr','Human Resources','organization','typescript'),('identity','Identity','security','typescript'),
('journey','Customer Journey','engagement','typescript'),('marketing','Marketing Automation','marketing','typescript'),('mcp','MCP Tools','integration','typescript'),
('membership','Membership','commerce','typescript'),('notification','Notifications','communication','typescript'),('observability','Observability','platform','typescript'),
('pose','Pose AI','wellness','typescript'),('pricing','Pricing','commerce','typescript'),('referral','Referrals','marketing','typescript'),
('scheduling','Scheduling','operations','typescript'),('security','Security','security','typescript'),('social','Social Publishing','marketing','typescript'),
('student','Students','education','typescript'),('survey','Surveys','engagement','typescript'),('teacher','Teachers','education','typescript'),
('teaching','Teaching','education','typescript'),('wellness','Wellness','wellness','typescript'),('yoga','Yoga','wellness','typescript')
ON CONFLICT(module_key) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,runtime_language=EXCLUDED.runtime_language;

CREATE OR REPLACE VIEW v_module_assurance AS
SELECT m.id,m.module_key,m.name,m.category,m.runtime_language,m.enabled,m.lifecycle_status,
 count(DISTINCT f.id)::int features,count(DISTINCT d.id)::int database_objects,
 count(DISTINCT d.id) FILTER(WHERE d.has_primary_key)::int objects_with_pk,
 coalesce(sum(DISTINCT d.foreign_key_count),0)::int foreign_keys,
 count(DISTINCT t.id) FILTER(WHERE t.status='passed')::int passed_tests,
 count(DISTINCT t.id) FILTER(WHERE t.status='failed')::int failed_tests,max(t.run_at) last_tested_at
FROM module_master m LEFT JOIN module_feature f ON f.module_id=m.id
LEFT JOIN module_database_object d ON d.module_id=m.id LEFT JOIN module_test_run t ON t.module_id=m.id
GROUP BY m.id;
