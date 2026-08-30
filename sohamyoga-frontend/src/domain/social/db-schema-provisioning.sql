-- Social account provisioning control plane. Security challenges are recorded as
-- workflow tasks only; OTP values, passwords, tokens and 2FA seeds never belong here.

CREATE TABLE IF NOT EXISTS social_brand_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenant(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL, legal_name TEXT, website_url TEXT,
  privacy_policy_url TEXT, terms_url TEXT, support_url TEXT,
  tagline TEXT, bio_80 TEXT, bio_150 TEXT, bio_255 TEXT,
  description_1000 TEXT, description_2000 TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}', default_hashtags TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT, square_logo_url TEXT, banner_url TEXT,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','review_required','approved','rejected')),
  approved_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_platform_requirement (
  platform TEXT PRIMARY KEY REFERENCES ref_social_platform(platform),
  signup_url TEXT, developer_portal_url TEXT,
  oauth_supported BOOLEAN NOT NULL DEFAULT false, api_supported BOOLEAN NOT NULL DEFAULT false,
  publishing_supported BOOLEAN NOT NULL DEFAULT false, requires_business_page BOOLEAN NOT NULL DEFAULT false,
  requires_phone BOOLEAN NOT NULL DEFAULT false, requires_captcha BOOLEAN NOT NULL DEFAULT true,
  requires_otp BOOLEAN NOT NULL DEFAULT true, requires_2fa BOOLEAN NOT NULL DEFAULT true,
  requires_identity_verification BOOLEAN NOT NULL DEFAULT false,
  requires_business_verification BOOLEAN NOT NULL DEFAULT false,
  developer_creation_mode TEXT NOT NULL CHECK (developer_creation_mode IN ('MANUAL','ASSISTED_BROWSER','OFFICIAL_API','PARTNER_PROVISIONING_API')),
  automation_policy TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO social_platform_requirement
  (platform, signup_url, developer_portal_url, oauth_supported, api_supported, publishing_supported,
   requires_business_page, requires_business_verification, developer_creation_mode, automation_policy)
VALUES
  ('facebook','https://www.facebook.com/pages/create','https://developers.facebook.com/apps/',true,true,true,true,true,'MANUAL','Assisted setup only. Never bypass CAPTCHA, OTP, 2FA, identity checks, app review, or terms acceptance.'),
  ('instagram','https://www.instagram.com/accounts/emailsignup/','https://developers.facebook.com/apps/',true,true,true,true,true,'MANUAL','Provision through a Meta business and Facebook Page; all security and consent steps are human-controlled.'),
  ('linkedin','https://www.linkedin.com/signup','https://www.linkedin.com/developers/apps',true,true,true,true,true,'MANUAL','Ordinary apps are created manually. Partner provisioning API must not be used without explicit platform approval.')
ON CONFLICT (platform) DO UPDATE SET
  signup_url=EXCLUDED.signup_url, developer_portal_url=EXCLUDED.developer_portal_url,
  oauth_supported=EXCLUDED.oauth_supported, api_supported=EXCLUDED.api_supported,
  publishing_supported=EXCLUDED.publishing_supported, automation_policy=EXCLUDED.automation_policy,
  updated_at=now();

CREATE TABLE IF NOT EXISTS account_provisioning_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  platform TEXT NOT NULL REFERENCES ref_social_platform(platform),
  state TEXT NOT NULL DEFAULT 'DRAFT', current_step TEXT,
  account_name TEXT NOT NULL, profile_url TEXT,
  creation_mode TEXT NOT NULL DEFAULT 'ASSISTED_BROWSER' CHECK (creation_mode IN ('MANUAL','ASSISTED_BROWSER','OFFICIAL_API','PARTNER_PROVISIONING_API')),
  credential_reference TEXT CHECK (credential_reference IS NULL OR credential_reference LIKE 'vault://%'),
  error_code TEXT, error_message TEXT, version INTEGER NOT NULL DEFAULT 1,
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_provisioning_job_tenant_state ON account_provisioning_job(tenant_id,state,updated_at DESC);

CREATE TABLE IF NOT EXISTS provisioning_human_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES account_provisioning_job(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  platform TEXT NOT NULL REFERENCES ref_social_platform(platform),
  task_type TEXT NOT NULL CHECK (task_type IN ('CAPTCHA','EMAIL_OTP','PHONE_OTP','TWO_FACTOR_SETUP','OAUTH_APPROVAL','IDENTITY_VERIFICATION','BUSINESS_VERIFICATION','TERMS_ACCEPTANCE')),
  instructions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','expired','cancelled')),
  external_session_reference TEXT, due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_human_task_open ON provisioning_human_task(tenant_id,status,due_at);

CREATE TABLE IF NOT EXISTS social_developer_application (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_id UUID REFERENCES account_provisioning_job(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE, platform TEXT NOT NULL REFERENCES ref_social_platform(platform),
  display_name TEXT NOT NULL, external_app_id TEXT, creation_mode TEXT NOT NULL,
  credential_reference TEXT CHECK (credential_reference IS NULL OR credential_reference LIKE 'vault://%'),
  status TEXT NOT NULL DEFAULT 'pending', products TEXT[] NOT NULL DEFAULT '{}', permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_oauth_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  platform TEXT NOT NULL REFERENCES ref_social_platform(platform), developer_application_id UUID REFERENCES social_developer_application(id),
  social_account_id UUID REFERENCES social_account(id), scopes TEXT[] NOT NULL DEFAULT '{}',
  token_reference TEXT NOT NULL CHECK (token_reference LIKE 'vault://%'), refresh_token_reference TEXT CHECK (refresh_token_reference IS NULL OR refresh_token_reference LIKE 'vault://%'),
  token_expires_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'pending', last_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_provisioning_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_id UUID REFERENCES account_provisioning_job(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE, platform TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN','SYSTEM','AI','BROWSER_AGENT','API')),
  actor_id TEXT, action TEXT NOT NULL, before_state TEXT, after_state TEXT, result TEXT NOT NULL,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(), metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provisioning_event_job ON social_provisioning_event(job_id,created_at DESC);

