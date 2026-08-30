-- Digital marketing production control plane: actual jobs, assets, channel
-- readiness, responses, form attribution and immutable operator/provider logs.
CREATE TABLE IF NOT EXISTS marketing_workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Edmonton', status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO marketing_workspace(name) VALUES ('Primary workspace') ON CONFLICT (name) DO NOTHING;

ALTER TABLE campaign ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES marketing_workspace(id);
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS objective TEXT NOT NULL DEFAULT '';
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
UPDATE campaign SET workspace_id=(SELECT id FROM marketing_workspace WHERE name='Primary workspace') WHERE workspace_id IS NULL;

CREATE TABLE IF NOT EXISTS marketing_channel_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN('youtube','facebook','instagram','linkedin','email','whatsapp','voice','higgsfield')),
  provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'missing_credentials'
    CHECK(status IN('missing_credentials','configured','connected','degraded','disabled')),
  external_account_label TEXT, last_health_at TIMESTAMPTZ, last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,channel)
);
-- Correct the earlier provider-name misunderstanding on already-migrated DBs.
ALTER TABLE marketing_channel_connection DROP CONSTRAINT IF EXISTS marketing_channel_connection_channel_check;
DELETE FROM marketing_channel_connection old
WHERE old.channel='hugging_face' AND EXISTS (
  SELECT 1 FROM marketing_channel_connection current
  WHERE current.workspace_id=old.workspace_id AND current.channel='higgsfield'
);
UPDATE marketing_channel_connection SET channel='higgsfield',provider='Higgsfield AI',updated_at=now() WHERE channel='hugging_face';
ALTER TABLE marketing_channel_connection ADD CONSTRAINT marketing_channel_connection_channel_check
  CHECK(channel IN('youtube','facebook','instagram','linkedin','email','whatsapp','voice','higgsfield'));

INSERT INTO marketing_channel_connection(workspace_id,channel,provider)
SELECT w.id,x.channel,x.provider FROM marketing_workspace w CROSS JOIN (VALUES
 ('youtube','Postiz / YouTube Data API'),('facebook','Postiz'),('instagram','Postiz'),('linkedin','Postiz'),
 ('email','Mautic / SMTP'),('whatsapp','WhatsApp Business Platform'),('voice','PSTN provider + local Voice AI'),
 ('higgsfield','Higgsfield AI')) x(channel,provider)
ON CONFLICT(workspace_id,channel) DO NOTHING;

CREATE TABLE IF NOT EXISTS marketing_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK(asset_type IN('script','voice_audio','video','thumbnail','caption','email_template')),
  title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN('draft','generating','ready_for_review','approved','rejected','failed','published')),
  content TEXT, file_path TEXT, mime_type TEXT, provider TEXT, provider_asset_id TEXT,
  duration_seconds NUMERIC(10,2), metadata JSONB NOT NULL DEFAULT '{}', checksum_sha256 TEXT,
  approved_by TEXT, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_asset_workspace ON marketing_asset(workspace_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_production_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL, asset_id UUID REFERENCES marketing_asset(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK(job_type IN('script_generate','voice_generate','video_render','youtube_publish','social_publish','response_sync','analytics_sync')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','blocked','succeeded','failed','cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10), idempotency_key TEXT NOT NULL UNIQUE,
  input JSONB NOT NULL DEFAULT '{}', output JSONB NOT NULL DEFAULT '{}', blocker TEXT, error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_job_due ON marketing_production_job(status,scheduled_at) WHERE status='queued';

CREATE TABLE IF NOT EXISTS marketing_interaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL, channel TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN('inbound','outbound')), interaction_type TEXT NOT NULL,
  external_id TEXT, customer_address TEXT, content TEXT, sentiment TEXT, intent TEXT, response_status TEXT NOT NULL DEFAULT 'new'
    CHECK(response_status IN('new','triaged','assigned','replied','closed','suppressed')),
  assigned_to TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE(channel,external_id)
);
CREATE INDEX IF NOT EXISTS idx_marketing_interaction_queue ON marketing_interaction(workspace_id,response_status,occurred_at DESC);

CREATE TABLE IF NOT EXISTS marketing_form_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE CASCADE, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  clicks BIGINT NOT NULL DEFAULT 0, submissions BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_event_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL, correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, actor TEXT NOT NULL DEFAULT 'system',
  provider TEXT, outcome TEXT NOT NULL CHECK(outcome IN('info','success','blocked','failure')),
  details JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_event_workspace ON marketing_event_log(workspace_id,occurred_at DESC);

-- Configurable multi-provider AI Content Factory. Rows are operator-editable
-- placeholders until a real provider connection and successful job prove them.
CREATE TABLE IF NOT EXISTS content_factory_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL, display_name TEXT NOT NULL, capabilities TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'placeholder' CHECK(status IN('placeholder','configured','connected','degraded','disabled')),
  selected_model TEXT, manual_notes TEXT NOT NULL DEFAULT '', last_health_at TIMESTAMPTZ, last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,provider_key)
);
INSERT INTO content_factory_provider(workspace_id,provider_key,display_name,capabilities)
SELECT w.id,p.key,p.name,p.capabilities FROM marketing_workspace w CROSS JOIN (VALUES
 ('higgsfield','Higgsfield AI',ARRAY['short_video','ugc','camera_control','character_consistency','explainer']),
 ('kling','Kling AI',ARRAY['text_to_video','image_to_video']),('veo','Google Veo',ARRAY['text_to_video','audio_video']),
 ('sora','OpenAI Sora',ARRAY['text_to_video']),('seedance','Seedance',ARRAY['text_to_video']),
 ('wan','Wan',ARRAY['text_to_video','image_to_video']),('local_ffmpeg','Local FFmpeg',ARRAY['assembly','caption_burn','transcode']))
 p(key,name,capabilities) ON CONFLICT(workspace_id,provider_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS content_factory_type (
  type_key TEXT PRIMARY KEY, display_name TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true,
  manual_guidance TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO content_factory_type(type_key,display_name) VALUES
 ('devotional','Devotional'),('kids_devotional','Kids devotional'),('nursery_rhyme','Nursery rhyme'),('story','Story'),
 ('educational','Educational'),('motivational','Motivational'),('festival','Festival'),('meditation','Meditation'),
 ('music_video','Music video'),('cinematic','Cinematic'),('meme','Meme'),('brainrot','High-retention meme/brainrot'),
 ('shorts_reels','Shorts/Reels'),('advertisement','Advertisement'),('product_marketing','Product marketing')
ON CONFLICT(type_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS content_factory_stage (
  stage_key TEXT PRIMARY KEY, display_name TEXT NOT NULL, sort_order INT NOT NULL UNIQUE,
  automation_status TEXT NOT NULL DEFAULT 'placeholder' CHECK(automation_status IN('placeholder','manual','configured','operational','disabled')),
  provider_key TEXT, manual_instructions TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO content_factory_stage(stage_key,display_name,sort_order) VALUES
 ('topic','Topic',10),('audience','Audience',20),('language_culture','Language & culture',30),('trend_research','Trend research',40),
 ('concept','Concept & hook',50),('script_lyrics','Script / lyrics',60),('storyboard','Storyboard',70),('character','Character consistency',80),
 ('image_generation','Image generation',90),('video_generation','Video generation',100),('voice_music_sfx','Voice, music & SFX',110),
 ('lip_sync','Lip sync',120),('editing','Editing',130),('captions','Captions',140),('thumbnail','Thumbnail',150),
 ('seo_geo','SEO & GEO metadata',160),('approval','Human approval',170),('publishing','Publishing',180),
 ('analytics','Analytics',190),('optimization','Optimization',200)
ON CONFLICT(stage_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS content_factory_project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL, title TEXT NOT NULL, topic TEXT NOT NULL,
  audience TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'English', culture_religion TEXT,
  content_type TEXT NOT NULL REFERENCES content_factory_type(type_key), emotion TEXT, visual_style TEXT,
  duration_seconds INT NOT NULL DEFAULT 30 CHECK(duration_seconds BETWEEN 5 AND 3600), aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','planned','producing','review','approved','scheduled','published','failed')),
  manual_notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_factory_variant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES content_factory_project(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL, style TEXT NOT NULL, duration_seconds INT NOT NULL, hook TEXT, cta TEXT,
  provider_key TEXT, status TEXT NOT NULL DEFAULT 'placeholder' CHECK(status IN('placeholder','draft','generating','review','approved','published','failed')),
  asset_id UUID REFERENCES marketing_asset(id) ON DELETE SET NULL, manual_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_factory_metric (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, project_id UUID NOT NULL REFERENCES content_factory_project(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES content_factory_variant(id) ON DELETE CASCADE, channel TEXT NOT NULL, measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  impressions BIGINT NOT NULL DEFAULT 0, views BIGINT NOT NULL DEFAULT 0, three_second_views BIGINT NOT NULL DEFAULT 0,
  completions BIGINT NOT NULL DEFAULT 0, rewatches BIGINT NOT NULL DEFAULT 0, shares BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0, clicks BIGINT NOT NULL DEFAULT 0, conversions BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC(14,2) NOT NULL DEFAULT 0, revenue NUMERIC(14,2) NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS content_factory_search_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL UNIQUE REFERENCES content_factory_project(id) ON DELETE CASCADE,
  primary_keyword TEXT, search_intent TEXT, title TEXT, description TEXT, tags TEXT[] NOT NULL DEFAULT '{}', chapters JSONB NOT NULL DEFAULT '[]',
  transcript TEXT, schema_markup JSONB NOT NULL DEFAULT '{}', answer_summary TEXT, entity_mentions TEXT[] NOT NULL DEFAULT '{}',
  citation_urls TEXT[] NOT NULL DEFAULT '{}', geo_target TEXT, local_business_cta TEXT, manual_notes TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_factory_nps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID REFERENCES content_factory_project(id) ON DELETE SET NULL,
  respondent_ref TEXT, score INT NOT NULL CHECK(score BETWEEN 0 AND 10), feedback TEXT, source_channel TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice AI operations. PSTN execution is always provider- and consent-gated;
-- local TTS previews are real assets but never count as completed calls.
CREATE TABLE IF NOT EXISTS voice_agent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL, purpose TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'English', voice_name TEXT NOT NULL DEFAULT 'en',
  system_instructions TEXT NOT NULL DEFAULT '', knowledge_scope TEXT NOT NULL DEFAULT '',
  human_handoff_rule TEXT NOT NULL DEFAULT 'Transfer on request, low confidence, complaint, payment, medical, or emergency content.',
  recording_disclosure TEXT NOT NULL DEFAULT 'This call may be recorded and processed by an AI assistant.',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review','approved','active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_script (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES voice_agent(id) ON DELETE SET NULL, campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL,
  name TEXT NOT NULL, script_type TEXT NOT NULL CHECK(script_type IN('inbound','outbound','voicemail','qualification','appointment','follow_up','nps','complaint_recovery')),
  opening TEXT NOT NULL, discovery_questions JSONB NOT NULL DEFAULT '[]', objection_handling JSONB NOT NULL DEFAULT '{}',
  call_to_action TEXT, required_disclosures TEXT NOT NULL DEFAULT '', forbidden_claims TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review','approved','active','archived')),
  approved_by TEXT, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_call (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL, agent_id UUID REFERENCES voice_agent(id) ON DELETE SET NULL,
  script_id UUID REFERENCES voice_script(id) ON DELETE SET NULL, direction TEXT NOT NULL CHECK(direction IN('inbound','outbound')),
  customer_ref TEXT, phone_e164 TEXT, consent_basis TEXT, do_not_call_checked_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ, started_at TIMESTAMPTZ, answered_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','blocked','scheduled','ringing','answered','completed','failed','cancelled','transferred','voicemail')),
  provider TEXT, provider_call_id TEXT UNIQUE, blocker TEXT, disposition TEXT, intent TEXT, sentiment TEXT,
  transcript TEXT, summary TEXT, recording_url TEXT, recording_consent BOOLEAN, assigned_to TEXT,
  duration_seconds INT, cost NUMERIC(12,4), currency TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(direction='inbound' OR phone_e164 IS NULL OR phone_e164 ~ '^[+][1-9][0-9]{7,14}$')
);
ALTER TABLE voice_call DROP CONSTRAINT IF EXISTS voice_call_check;
ALTER TABLE voice_call ADD CONSTRAINT voice_call_check
  CHECK(direction='inbound' OR phone_e164 IS NULL OR phone_e164 ~ '^[+][1-9][0-9]{7,14}$');
CREATE INDEX IF NOT EXISTS idx_voice_call_queue ON voice_call(workspace_id,status,scheduled_at);

CREATE TABLE IF NOT EXISTS voice_call_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, call_id UUID NOT NULL REFERENCES voice_call(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL, provider_event_id TEXT, payload JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_event_id)
);

-- Open-source SIP/PBX control plane. Credentials are held outside PostgreSQL;
-- secret_ref stores only the environment/vault key used by the runtime.
CREATE TABLE IF NOT EXISTS voice_sip_trunk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'Asterisk/PJSIP', host TEXT, port INT NOT NULL DEFAULT 5060,
  transport TEXT NOT NULL DEFAULT 'udp' CHECK(transport IN('udp','tcp','tls')), auth_username TEXT, secret_ref TEXT,
  inbound_did TEXT, outbound_caller_id TEXT, status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN('draft','configured','registering','registered','degraded','disabled')),
  last_registration_at TIMESTAMPTZ, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,name)
);
CREATE TABLE IF NOT EXISTS voice_sip_endpoint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  extension TEXT NOT NULL, display_name TEXT NOT NULL, secret_ref TEXT NOT NULL, codecs TEXT[] NOT NULL DEFAULT ARRAY['ulaw','alaw'],
  status TEXT NOT NULL DEFAULT 'configured' CHECK(status IN('configured','online','offline','disabled')),
  last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,extension)
);
CREATE TABLE IF NOT EXISTS voice_modulation_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL, voice_name TEXT NOT NULL DEFAULT 'en', language TEXT NOT NULL DEFAULT 'English',
  speaking_rate NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK(speaking_rate BETWEEN .5 AND 2),
  pitch_semitones NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK(pitch_semitones BETWEEN -12 AND 12),
  volume_db NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK(volume_db BETWEEN -12 AND 6), style TEXT NOT NULL DEFAULT 'professional',
  cloning_consent_ref TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,name)
);
CREATE TABLE IF NOT EXISTS voice_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN('inbound','outbound','both')), version INT NOT NULL DEFAULT 1,
  steps JSONB NOT NULL DEFAULT '[]', fallback_action TEXT NOT NULL DEFAULT 'human_handoff',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review','approved','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,name,version)
);
CREATE TABLE IF NOT EXISTS voice_routing_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL, priority INT NOT NULL DEFAULT 100, inbound_did TEXT, trunk_id UUID REFERENCES voice_sip_trunk(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES voice_agent(id) ON DELETE SET NULL, script_id UUID REFERENCES voice_script(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES voice_workflow(id) ON DELETE SET NULL, business_hours JSONB NOT NULL DEFAULT '{}',
  fallback_extension TEXT, enabled BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,name)
);
CREATE TABLE IF NOT EXISTS voice_monitor_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'asterisk', healthy BOOLEAN NOT NULL, active_channels INT NOT NULL DEFAULT 0,
  registered_trunks INT NOT NULL DEFAULT 0, queued_calls INT NOT NULL DEFAULT 0, asr_latency_ms INT, tts_latency_ms INT,
  details JSONB NOT NULL DEFAULT '{}', measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE voice_call ADD COLUMN IF NOT EXISTS trunk_id UUID REFERENCES voice_sip_trunk(id) ON DELETE SET NULL;
ALTER TABLE voice_call ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES voice_workflow(id) ON DELETE SET NULL;
ALTER TABLE voice_call ADD COLUMN IF NOT EXISTS modulation_profile_id UUID REFERENCES voice_modulation_profile(id) ON DELETE SET NULL;
ALTER TABLE voice_call ADD COLUMN IF NOT EXISTS sip_response_code INT;

-- Construction digital-twin MVP: one transform model for every scene entity.
CREATE TABLE IF NOT EXISTS twin_project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL, unit_system TEXT NOT NULL DEFAULT 'metric' CHECK(unit_system IN('metric','imperial')),
  coordinate_system TEXT NOT NULL DEFAULT 'local', status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN('draft','active','review','archived')), source_format TEXT, source_file_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,name)
);
CREATE TABLE IF NOT EXISTS twin_scene_object (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES twin_project(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES twin_scene_object(id) ON DELETE CASCADE, name TEXT NOT NULL, object_type TEXT NOT NULL,
  position_x NUMERIC(12,3) NOT NULL DEFAULT 0, position_y NUMERIC(12,3) NOT NULL DEFAULT 0, position_z NUMERIC(12,3) NOT NULL DEFAULT 0,
  rotation_x NUMERIC(8,3) NOT NULL DEFAULT 0, rotation_y NUMERIC(8,3) NOT NULL DEFAULT 0, rotation_z NUMERIC(8,3) NOT NULL DEFAULT 0,
  width NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(width>0), height NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(height>0), depth NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(depth>0),
  material JSONB NOT NULL DEFAULT '{}', physics JSONB NOT NULL DEFAULT '{}', behavior JSONB NOT NULL DEFAULT '{}', metadata JSONB NOT NULL DEFAULT '{}',
  revision INT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(project_id,name)
);
CREATE INDEX IF NOT EXISTS idx_twin_object_project ON twin_scene_object(project_id,parent_id);
CREATE TABLE IF NOT EXISTS twin_constraint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES twin_project(id) ON DELETE CASCADE,
  name TEXT NOT NULL, constraint_type TEXT NOT NULL, parameters JSONB NOT NULL DEFAULT '{}', severity TEXT NOT NULL DEFAULT 'error'
    CHECK(severity IN('info','warning','error')), enabled BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS twin_command (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES twin_project(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL, parsed_intent JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'proposed'
    CHECK(status IN('proposed','approved','applied','rejected','failed')), target_object_id UUID REFERENCES twin_scene_object(id) ON DELETE SET NULL,
  before_state JSONB, after_state JSONB, validation JSONB NOT NULL DEFAULT '{}', approved_by TEXT, approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS twin_provider (
  provider_key TEXT PRIMARY KEY, display_name TEXT NOT NULL, role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placeholder' CHECK(status IN('placeholder','installed','configured','operational','disabled')),
  last_health_at TIMESTAMPTZ, last_error TEXT
);
INSERT INTO twin_provider(provider_key,display_name,role,status) VALUES
 ('threejs','Three.js','Browser configurator','operational'),('blender','Blender','Asset creation','placeholder'),
 ('ifcopenshell','IfcOpenShell','IFC/BIM import','placeholder'),('godot','Godot','Physics simulation','placeholder'),
 ('cesium','CesiumJS','GIS/city digital twin','placeholder'),('openfoam','OpenFOAM','Fluid engineering','placeholder'),
 ('calculix','CalculiX','Structural engineering','placeholder'),('webxr','WebXR','AR/VR walkthrough','placeholder')
ON CONFLICT(provider_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS twin_plan_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES twin_project(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL, file_path TEXT NOT NULL, mime_type TEXT NOT NULL, checksum_sha256 TEXT NOT NULL,
  image_width INT, image_height INT, unit TEXT NOT NULL DEFAULT 'ft', scale_per_pixel NUMERIC(12,6),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN('uploaded','processing','review','approved','applied','failed')),
  recognition_provider TEXT NOT NULL DEFAULT 'OpenCV + Tesseract', confidence NUMERIC(5,4), raw_result JSONB NOT NULL DEFAULT '{}',
  error_message TEXT, approved_by TEXT, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS twin_plan_element (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), import_id UUID NOT NULL REFERENCES twin_plan_import(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL CHECK(element_type IN('external_wall','internal_wall','room','door','window','staircase','column','balcony','text','north_arrow','unknown')),
  label TEXT, geometry JSONB NOT NULL, confidence NUMERIC(5,4) NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'detected',
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN('unreviewed','accepted','corrected','rejected')),
  metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_twin_plan_element_import ON twin_plan_element(import_id,element_type,review_status);
INSERT INTO twin_provider(provider_key,display_name,role,status,last_health_at) VALUES
 ('opencv','OpenCV','Sketch cleanup and geometry detection','operational',now()),
 ('tesseract','Tesseract OCR','Plan label recognition','operational',now()),
 ('shapely','Shapely','Geometry validation','installed',now())
ON CONFLICT(provider_key) DO UPDATE SET status=EXCLUDED.status,last_health_at=EXCLUDED.last_health_at;

-- Hybrid media router: routing decisions are evidence, not provider claims.
CREATE TABLE IF NOT EXISTS media_quality_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, tier TEXT NOT NULL CHECK(tier IN('standard','premium','studio')),
  target_score NUMERIC(5,2) NOT NULL CHECK(target_score BETWEEN 0 AND 100), weights JSONB NOT NULL,
  max_cost_per_minute NUMERIC(12,4), max_latency_seconds INT, privacy_mode TEXT NOT NULL DEFAULT 'hybrid'
    CHECK(privacy_mode IN('local_only','hybrid','cloud_allowed')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO media_quality_profile(name,tier,target_score,weights,privacy_mode) VALUES
 ('Standard Open First','standard',80,'{"prompt_adherence":12,"character_consistency":12,"visual_quality":10,"motion_quality":10,"temporal_consistency":10,"cultural_accuracy":10,"audio_quality":7,"lip_sync":5,"scene_continuity":7,"artifact_avoidance":5,"story_continuity":5,"audience_appropriateness":4,"technical_quality":3}','local_only'),
 ('Premium Hybrid','premium',90,'{"prompt_adherence":12,"character_consistency":12,"visual_quality":10,"motion_quality":10,"temporal_consistency":10,"cultural_accuracy":10,"audio_quality":7,"lip_sync":5,"scene_continuity":7,"artifact_avoidance":5,"story_continuity":5,"audience_appropriateness":4,"technical_quality":3}','hybrid'),
 ('Studio QA','studio',95,'{"prompt_adherence":12,"character_consistency":12,"visual_quality":10,"motion_quality":10,"temporal_consistency":10,"cultural_accuracy":10,"audio_quality":7,"lip_sync":5,"scene_continuity":7,"artifact_avoidance":5,"story_continuity":5,"audience_appropriateness":4,"technical_quality":3}','cloud_allowed')
ON CONFLICT(name) DO NOTHING;
CREATE TABLE IF NOT EXISTS media_quality_evaluation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), variant_id UUID REFERENCES content_factory_variant(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES media_quality_profile(id), evaluator TEXT NOT NULL, scores JSONB NOT NULL,
  weighted_score NUMERIC(5,2) NOT NULL CHECK(weighted_score BETWEEN 0 AND 100), decision TEXT NOT NULL CHECK(decision IN('pass','regenerate_local','premium_fallback','human_review')),
  evidence JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media_routing_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID REFERENCES content_factory_project(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, quality_tier TEXT NOT NULL, selected_pipeline TEXT NOT NULL, selected_provider TEXT,
  factors JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN('proposed','approved','executing','completed','blocked','failed')),
  estimated_cost NUMERIC(12,4), actual_cost NUMERIC(12,4), rationale TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adaptive spatial learning shares the same central scene-graph principle.
CREATE TABLE IF NOT EXISTS spatial_lesson (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  title TEXT NOT NULL, topic TEXT NOT NULL, subject TEXT NOT NULL, grade_level TEXT NOT NULL, learning_objectives JSONB NOT NULL DEFAULT '[]',
  scene_template TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review','approved','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,title,grade_level)
);
CREATE TABLE IF NOT EXISTS spatial_lesson_object (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id UUID NOT NULL REFERENCES spatial_lesson(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL, label TEXT NOT NULL, object_type TEXT NOT NULL, position JSONB NOT NULL, scale JSONB NOT NULL DEFAULT '{"x":1,"y":1,"z":1}',
  knowledge JSONB NOT NULL DEFAULT '{}', interactions TEXT[] NOT NULL DEFAULT ARRAY['select'], constraints JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(lesson_id,object_key)
);
CREATE TABLE IF NOT EXISTS spatial_learning_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id UUID NOT NULL REFERENCES spatial_lesson(id) ON DELETE CASCADE,
  learner_ref TEXT, grade_level TEXT NOT NULL, device_mode TEXT NOT NULL DEFAULT 'desktop' CHECK(device_mode IN('desktop','ar','vr','mr')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','abandoned')), selected_object_id UUID REFERENCES spatial_lesson_object(id) ON DELETE SET NULL,
  mastery NUMERIC(5,2) NOT NULL DEFAULT 0, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS spatial_learning_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, session_id UUID NOT NULL REFERENCES spatial_learning_session(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, object_id UUID REFERENCES spatial_lesson_object(id) ON DELETE SET NULL, input_text TEXT, response_text TEXT,
  correctness NUMERIC(5,2), latency_ms INT, context JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS spatial_action_proposal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES spatial_learning_session(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES spatial_lesson_object(id) ON DELETE CASCADE, input_text TEXT NOT NULL,
  intent TEXT NOT NULL, before_state JSONB NOT NULL, proposed_state JSONB NOT NULL, validation JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN('proposed','blocked','approved','applied','rejected','failed')),
  blocker TEXT, approved_by TEXT, approved_at TIMESTAMPTZ, applied_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spatial_action_session ON spatial_action_proposal(session_id,created_at DESC);
