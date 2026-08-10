-- Multi-tenant marketing automation extension.
-- Apply after domain/core/db-foundation.sql and domain/social/db-schema.sql.

CREATE TABLE IF NOT EXISTS marketing_business_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenant(id) ON DELETE CASCADE,
  industry TEXT NOT NULL CHECK (industry IN ('yoga','dental','retail','restaurant','professional_services','other')),
  business_name TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT '',
  value_proposition TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  default_timezone TEXT NOT NULL DEFAULT 'America/Edmonton',
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  brand_voice JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_ai_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'general'
    CHECK (purpose IN ('general','copy','code','image_prompt','video_script','embedding')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  max_output_tokens INTEGER NOT NULL DEFAULT 768 CHECK (max_output_tokens BETWEEN 64 AND 32768),
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.40 CHECK (temperature BETWEEN 0 AND 2),
  last_health_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (last_health_status IN ('unknown','healthy','unavailable')),
  last_health_check_at TIMESTAMPTZ,
  updated_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, model_name)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_default_ai_model
  ON tenant_ai_model(tenant_id) WHERE is_default AND enabled;

CREATE TABLE IF NOT EXISTS tenant_channel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'facebook','instagram','linkedin','x_twitter','threads','tiktok','youtube',
    'pinterest','reddit','bluesky','google_business','email','sms'
  )),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  connection_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','pending','connected','expired','error')),
  provider TEXT NOT NULL DEFAULT 'postiz',
  external_account_id TEXT,
  credential_reference TEXT,
  capabilities JSONB NOT NULL DEFAULT '{}',
  last_health_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel)
);

CREATE TABLE IF NOT EXISTS marketing_automation_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  industry TEXT NOT NULL,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT '',
  offer_text TEXT NOT NULL DEFAULT '',
  call_to_action TEXT NOT NULL DEFAULT '',
  asset_types TEXT[] NOT NULL DEFAULT ARRAY['static_banner']::TEXT[],
  channels TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  model_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('draft','queued','generating','review_required','approved','scheduled','publishing','published','failed','cancelled')),
  progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  current_stage TEXT NOT NULL DEFAULT 'brief',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_request_queue
  ON marketing_automation_request(status, scheduled_at, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_request_tenant
  ON marketing_automation_request(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS generated_marketing_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES marketing_automation_request(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('copy','static_banner','dynamic_banner','video_script','video','thumbnail')),
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','rendering','review_required','approved','rejected','published','failed')),
  text_content TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  approved_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generated_asset_request ON generated_marketing_asset(request_id);

CREATE TABLE IF NOT EXISTS marketing_workflow_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES marketing_automation_request(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN ('user','admin','service_provider','system','ollama')),
  actor_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_workflow_request
  ON marketing_workflow_event(request_id, created_at);

CREATE OR REPLACE VIEW v_marketing_automation_dashboard AS
SELECT r.id, r.tenant_id, r.title, r.industry, r.objective, r.asset_types,
       r.channels, r.scheduled_at, r.status, r.progress_percent, r.current_stage,
       r.model_name, r.error_message, r.created_at, r.updated_at,
       COUNT(a.id) AS asset_count,
       COUNT(a.id) FILTER (WHERE a.status = 'approved') AS approved_asset_count
FROM marketing_automation_request r
LEFT JOIN generated_marketing_asset a ON a.request_id = r.id
GROUP BY r.id;
