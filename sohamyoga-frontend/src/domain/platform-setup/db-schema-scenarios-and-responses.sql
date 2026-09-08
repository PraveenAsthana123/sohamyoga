-- Cross-platform scenario catalog and two-way customer-response ledger.
-- This records real events only; seeded scenarios are capabilities/plans, not outcomes.
CREATE TABLE IF NOT EXISTS integration_scenario (
  scenario_key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('integration','marketing','response','creative','intelligence','operations')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound','two_way','internal')),
  asset_types TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('automatic','approval_gated','manual','planned')),
  tracking_events TEXT[] NOT NULL DEFAULT '{}',
  required_capabilities TEXT[] NOT NULL DEFAULT '{}',
  demo_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  scale_profile TEXT NOT NULL DEFAULT 'tenant_queue',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('available','partial','blocked','planned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_channel_thread (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  platform_key TEXT NOT NULL,
  external_thread_id TEXT,
  customer_reference TEXT,
  campaign_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','waiting_customer','waiting_agent','resolved','blocked','spam')),
  assigned_to UUID REFERENCES app_user(id) ON DELETE SET NULL,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, platform_key, external_thread_id)
);

CREATE TABLE IF NOT EXISTS customer_channel_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES customer_channel_thread(id) ON DELETE SET NULL,
  platform_key TEXT NOT NULL,
  external_event_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound','system')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'impression','view','click','reaction','like','unlike','follow','unfollow','share','save',
    'comment','reply','mention','direct_message','email_open','email_click','email_reply',
    'form_submit','lead','conversion','notification_sent','notification_opened','delivery','bounce','complaint'
  )),
  content_reference TEXT,
  customer_reference TEXT,
  campaign_reference TEXT,
  text_excerpt TEXT,
  sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','negative','unknown')),
  intent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation_run_id UUID REFERENCES operation_run(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE NULLS NOT DISTINCT (tenant_id, platform_key, external_event_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_channel_event_tenant_time ON customer_channel_event(tenant_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_channel_event_platform_type ON customer_channel_event(platform_key,event_type,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_channel_thread_queue ON customer_channel_thread(tenant_id,status,updated_at DESC);

INSERT INTO integration_scenario
(scenario_key,category,title,description,direction,asset_types,platform_keys,execution_mode,tracking_events,required_capabilities,demo_steps,scale_profile,status)
VALUES
('cross_platform_post','marketing','One post to many platforms','Approve one content package, create platform variants, publish through connected adapters, and monitor delivery.','outbound',ARRAY['text','image','video'],ARRAY['facebook','instagram','linkedin','x_twitter','threads','medium','bluesky'], 'approval_gated',ARRAY['delivery','view','click','reaction','comment','share'],ARRAY['social_publishing','conversion_tracking'],'["Create content","Select platforms","Preview variants","Approve","Publish","Review events"]','partition_by_tenant_platform','partial'),
('unified_social_inbox','response','Unified social inbox','Collect comments, mentions and direct messages into customer threads with assignment, suggested replies and resolution tracking.','two_way',ARRAY['text'],ARRAY['facebook','instagram','linkedin','x_twitter','threads','youtube'], 'approval_gated',ARRAY['comment','reply','mention','direct_message','notification_sent'],ARRAY['social_listening','unified_inbox'],'["Receive webhook","Resolve identity","Classify","Assign","Reply","Close"]','partition_by_tenant_platform','partial'),
('engagement_followup','response','Engagement follow-up','Track clicks, likes, follows and replies, then create consent-aware follow-up work.','two_way',ARRAY['text','notification'],ARRAY['facebook','instagram','linkedin','x_twitter'], 'approval_gated',ARRAY['click','like','follow','reply','lead','conversion'],ARRAY['conversion_tracking','privacy_compliance'],'["Capture event","Deduplicate","Apply consent","Create work item","Notify owner"]','event_stream','partial'),
('email_campaign','marketing','Email campaign and reply tracking','Compose, approve and send email with delivery, open, click, reply, bounce and complaint tracking.','two_way',ARRAY['email','text','image','pdf'],ARRAY['smtp','novu_email'], 'approval_gated',ARRAY['delivery','email_open','email_click','email_reply','bounce','complaint'],ARRAY['unified_inbox','conversion_tracking','privacy_compliance'],'["Select audience","Compose","Attach asset","Approve","Send","Track","Respond"]','provider_batch_queue','partial'),
('paid_ads','marketing','Paid ads lifecycle','Create text/image/video ads, enforce budget approval, publish through provider APIs and track spend and conversion.','outbound',ARRAY['ad_copy','image','video'],ARRAY['meta_ads','google_ads'], 'approval_gated',ARRAY['impression','view','click','lead','conversion'],ARRAY['paid_media','budget_governance','attribution'],'["Brief","Generate variants","Approve budget","Publish","Monitor","Optimize"]','tenant_budget_queue','partial'),
('marketing_intelligence','intelligence','Marketing intelligence loop','Combine channel events, content attributes and conversions to rank audience, topic, hook, format, CTA and posting time.','internal',ARRAY['report','dashboard'],ARRAY[]::TEXT[], 'automatic',ARRAY['impression','view','click','lead','conversion'],ARRAY['content_learning','attribution','data_quality'],'["Ingest","Validate","Aggregate","Score","Recommend","Review"]','warehouse_aggregate','available'),
('document_campaign','creative','PDF and Word campaign assets','Create governed PDF/DOCX assets from approved content, store versions and distribute through email or download links.','outbound',ARRAY['pdf','docx'],ARRAY['smtp','novu_email'], 'approval_gated',ARRAY['click','form_submit','lead'],ARRAY['conversion_tracking'],'["Select template","Merge approved content","Render","QA","Approve","Distribute"]','render_queue','partial'),
('image_campaign','creative','Image creative workflow','Generate or upload images, apply brand templates, resize by platform, approve and publish.','outbound',ARRAY['image','thumbnail','carousel'],ARRAY['facebook','instagram','linkedin','pinterest'], 'approval_gated',ARRAY['impression','view','click','reaction','save'],ARRAY['image_pipeline','social_publishing'],'["Brief","Create","Brand","Resize","QA","Approve","Publish"]','render_queue','partial'),
('short_video_reel','creative','Short video and reels','Create vertical short-form video with hook, captions, voice, music mix, labels, tags, compression and platform variants.','outbound',ARRAY['short_video','reel','caption','thumbnail'],ARRAY['instagram','tiktok','youtube','facebook'], 'approval_gated',ARRAY['view','click','reaction','comment','share','save'],ARRAY['video_pipeline','social_publishing'],'["Brief","Hook","Storyboard","Edit","Voice","Mix","Caption","QA","Compress","Approve","Publish"]','gpu_render_queue','partial'),
('long_video_education','creative','Long educational video','Turn approved chapters or lessons into long-form educational video with sections, narration, captions, references and review gates.','outbound',ARRAY['long_video','chapter','caption','thumbnail'],ARRAY['youtube','vimeo'], 'approval_gated',ARRAY['view','click','comment','share'],ARRAY['video_pipeline'],'["Import chapter","Outline","Storyboard","Narrate","Compose","Review","Render","Publish"]','gpu_render_queue','partial'),
('advanced_video_composition','creative','Advanced video composition','HyperFrames-backed seek-safe composition for text, labels, hooks, 2D/3D scenes, holographic treatments, voice, audio mixing and deterministic renders.','outbound',ARRAY['video','3d','voice','audio','caption'],ARRAY['youtube','vimeo','instagram','tiktok'], 'approval_gated',ARRAY['view','click','reaction','comment'],ARRAY['video_pipeline'],'["Create brief","Resolve media","Compose timeline","Animate","Mix","Validate","Render","Approve"]','gpu_render_queue','planned'),
('integration_health','operations','Integration health and troubleshooting','Validate credentials, run safe connection tests, record operation traces, errors, retries, circuit state and alerts.','internal',ARRAY['log','report'],ARRAY[]::TEXT[], 'automatic',ARRAY[]::TEXT[],ARRAY['multi_tenant_ops','data_quality'],'["Check","Trace","Retry","Open circuit","Alert","Resolve"]','partition_by_tenant','available')
ON CONFLICT(scenario_key) DO UPDATE SET
 description=EXCLUDED.description,direction=EXCLUDED.direction,asset_types=EXCLUDED.asset_types,
 platform_keys=EXCLUDED.platform_keys,execution_mode=EXCLUDED.execution_mode,
 tracking_events=EXCLUDED.tracking_events,required_capabilities=EXCLUDED.required_capabilities,
 demo_steps=EXCLUDED.demo_steps,scale_profile=EXCLUDED.scale_profile,status=EXCLUDED.status,updated_at=now();
