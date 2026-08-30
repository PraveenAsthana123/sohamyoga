-- Unified advanced marketing operations control plane.
-- Existing domain tables remain systems of record; these tables express maturity,
-- alerts and cross-channel learning without inventing delivery outcomes.
CREATE TABLE IF NOT EXISTS marketing_capability_definition(
 capability_key TEXT PRIMARY KEY, domain TEXT NOT NULL, display_name TEXT NOT NULL,
 description TEXT NOT NULL, target_maturity TEXT NOT NULL DEFAULT 'verified_outcomes',
 required_for_launch BOOLEAN NOT NULL DEFAULT false, sort_order INTEGER NOT NULL
);
INSERT INTO marketing_capability_definition(capability_key,domain,display_name,description,required_for_launch,sort_order) VALUES
 ('seo_technical','discovery','Technical SEO','Crawl, indexing, sitemap, Core Web Vitals and internal linking',false,10),
 ('geo_answer_visibility','discovery','GEO / Answer Visibility','Entity, citation and AI-answer visibility monitoring',false,20),
 ('paid_media','acquisition','Performance Marketing','Ad spend, pacing, creative performance, CAC and ROAS',false,30),
 ('conversion_tracking','measurement','Conversion Tracking','Browser and server events with deduplication',true,40),
 ('attribution','measurement','Revenue Attribution','Campaign touch to lead, booking, customer and revenue',true,50),
 ('video_pipeline','creative','Video Marketing','Script, render, caption, thumbnail, QA and variants',false,60),
 ('image_pipeline','creative','Image Creative','Brand templates, rendering, resizing and QA',false,70),
 ('content_learning','intelligence','Content Learning','Audience, topic, hook, format, CTA and time performance',false,80),
 ('social_publishing','activation','Social Publishing','Approval-gated multi-platform scheduling and delivery',true,90),
 ('social_listening','response','Social Listening','Mentions, comments, sentiment and escalation',false,100),
 ('unified_inbox','response','Unified Inbox','Email, web, social and WhatsApp response queue',false,110),
 ('email_response_ai','response','Email Response AI','Intent, sentiment and human-approved response suggestions',false,120),
 ('lifecycle_journeys','retention','Lifecycle Journeys','Welcome, nurture, win-back and renewal campaigns',false,130),
 ('audience_management','acquisition','Audience Management','Segments, exclusions, freshness and lookalikes',false,140),
 ('reputation','retention','Reputation Management','Reviews, responses, testimonials and escalation',false,150),
 ('local_marketing','discovery','Local Marketing','Business profiles, local rank and location content',false,160),
 ('data_quality','governance','Lead Data Quality','Validation, deduplication, provenance and confidence',true,170),
 ('budget_governance','governance','Budget Governance','Limits, pacing, anomalies and emergency stops',true,180),
 ('privacy_compliance','governance','Privacy and Suppression','Consent evidence, DNC, opt-out, retention and frequency caps',true,190),
 ('multi_tenant_ops','platform','Multi-customer Operations','Tenant roles, quotas, brands, SLAs and isolation',true,200)
ON CONFLICT(capability_key) DO UPDATE SET description=EXCLUDED.description,required_for_launch=EXCLUDED.required_for_launch,sort_order=EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS tenant_marketing_capability(
 tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
 capability_key TEXT NOT NULL REFERENCES marketing_capability_definition(capability_key),
 maturity TEXT NOT NULL DEFAULT 'missing' CHECK(maturity IN('missing','installed','configured','data_flowing','verified_outcomes')),
 provider TEXT, evidence JSONB NOT NULL DEFAULT '{}', blocker TEXT,
 last_health_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,capability_key)
);
INSERT INTO tenant_marketing_capability(tenant_id,capability_key)
SELECT t.id,c.capability_key FROM tenant t CROSS JOIN marketing_capability_definition c ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS marketing_operational_alert(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
 capability_key TEXT REFERENCES marketing_capability_definition(capability_key),severity TEXT NOT NULL CHECK(severity IN('info','warning','critical')),
 alert_type TEXT NOT NULL,title TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','acknowledged','resolved')),
 detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),acknowledged_by UUID,acknowledged_at TIMESTAMPTZ,resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_marketing_alert_open ON marketing_operational_alert(tenant_id,severity,detected_at DESC) WHERE status='open';

CREATE TABLE IF NOT EXISTS marketing_response_work_item(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
 channel TEXT NOT NULL,external_thread_id TEXT,contact_reference TEXT,inbound_text TEXT NOT NULL,
 intent TEXT,sentiment TEXT,urgency TEXT,ai_suggested_response TEXT,ai_model TEXT,
 status TEXT NOT NULL DEFAULT 'needs_review' CHECK(status IN('needs_review','approved','edited','sent','dismissed','failed')),
 assigned_to UUID,approved_by UUID,approved_at TIMESTAMPTZ,sent_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_response_review ON marketing_response_work_item(tenant_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_content_learning(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
 campaign_id UUID,post_id UUID REFERENCES social_post(id) ON DELETE SET NULL,channel TEXT NOT NULL,
 audience_key TEXT,topic TEXT,hook TEXT,creative_format TEXT,cta TEXT,published_hour SMALLINT CHECK(published_hour BETWEEN 0 AND 23),
 impressions BIGINT NOT NULL DEFAULT 0,engagements BIGINT NOT NULL DEFAULT 0,clicks BIGINT NOT NULL DEFAULT 0,leads BIGINT NOT NULL DEFAULT 0,conversions BIGINT NOT NULL DEFAULT 0,revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
 measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(tenant_id,post_id)
);

CREATE TABLE IF NOT EXISTS marketing_search_visibility_snapshot(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
 visibility_type TEXT NOT NULL CHECK(visibility_type IN('seo','geo','local')),query TEXT NOT NULL,engine TEXT NOT NULL,
 position NUMERIC(8,2),is_cited BOOLEAN,brand_mentioned BOOLEAN NOT NULL DEFAULT false,landing_url TEXT,
 evidence_url TEXT,measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visibility_trend ON marketing_search_visibility_snapshot(tenant_id,visibility_type,query,measured_at DESC);

CREATE TABLE IF NOT EXISTS marketing_budget_guardrail(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
 channel TEXT NOT NULL,daily_limit NUMERIC(12,2),monthly_limit NUMERIC(12,2),target_cac NUMERIC(12,2),minimum_roas NUMERIC(8,2),
 auto_pause_enabled BOOLEAN NOT NULL DEFAULT false,approval_threshold NUMERIC(12,2),currency TEXT NOT NULL DEFAULT 'CAD',active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(tenant_id,channel)
);
