-- Fills a real gap found while cross-checking the ChatGPT "Social Account
-- Provisioning Platform" conversation against this codebase: YouTube and
-- X/Twitter -- the two platforms that conversation itself calls "core
-- channels" alongside Instagram/LinkedIn/WhatsApp/Reddit/Quora -- had no
-- social_platform_requirement row at all, only a bare ref_social_platform
-- entry with no roadmap tier or automation policy. Slack and Dribbble had
-- the same gap. Facts below are real, publicly documented developer-program
-- details, not invented.

WITH roadmap(platform, priority, business_use, content_strength, automation_level, manual_prerequisite,
             signup_url, developer_portal_url, oauth_supported, api_supported, publishing_supported,
             requires_business_page, requires_business_verification, mode, policy) AS (VALUES
  ('youtube', 'red', 'Long-form and short-form video marketing, class recordings', 'Video (long-form and Shorts)', 'high',
   'Google account, Google Cloud project, OAuth consent screen verification',
   'https://www.youtube.com/create_channel', 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
   true, true, true, false, false, 'MANUAL',
   'Uses the YouTube Data API v3 under a Google Cloud project. OAuth consent screen verification and quota approval are human-controlled steps; never bypass Google account security checks.'),
  ('x_twitter', 'red', 'Real-time updates and customer conversation', 'Short text, image, and video threads', 'medium',
   'Developer account approval; a paid API tier is required for meaningful write access',
   'https://x.com/i/flow/signup', 'https://developer.x.com/en/portal/dashboard',
   true, true, true, false, false, 'MANUAL',
   'Since 2023 the free API tier does not support posting; a paid Basic/Pro tier is required for write access. Developer account approval and OAuth 2.0 consent remain human-controlled.'),
  ('slack', 'yellow', 'Internal community and customer support channels', 'Text, files, and interactive messages', 'high',
   'Workspace admin approval to install the app/bot',
   'https://slack.com/get-started', 'https://api.slack.com/apps',
   true, true, true, false, false, 'OFFICIAL_API',
   'A workspace admin must approve the app installation and its OAuth scopes; bot token creation is a first-class, well-documented API flow.'),
  ('dribbble', 'yellow', 'Design portfolio and creative-team visibility', 'Images (design shots)', 'none',
   'Account approval; Dribbble has not generally accepted new API applications since 2023',
   'https://dribbble.com/signup/new', 'https://dribbble.com/account/applications/new',
   true, false, false, false, false, 'MANUAL',
   'Dribbble stopped granting new public API access in 2023; existing keys still function but new write/publishing integrations are not realistically available. Do not claim publishing support.')
)
INSERT INTO social_platform_requirement
  (platform, priority, business_use, content_strength, automation_level, manual_prerequisite,
   signup_url, developer_portal_url, oauth_supported, api_supported, publishing_supported,
   requires_business_page, requires_business_verification, developer_creation_mode, automation_policy)
SELECT platform, priority, business_use, content_strength, automation_level, manual_prerequisite,
       signup_url, developer_portal_url, oauth_supported, api_supported, publishing_supported,
       requires_business_page, requires_business_verification, mode, policy
FROM roadmap
ON CONFLICT (platform) DO UPDATE SET
  priority = EXCLUDED.priority, business_use = EXCLUDED.business_use, content_strength = EXCLUDED.content_strength,
  automation_level = EXCLUDED.automation_level, manual_prerequisite = EXCLUDED.manual_prerequisite,
  signup_url = EXCLUDED.signup_url, developer_portal_url = EXCLUDED.developer_portal_url,
  oauth_supported = EXCLUDED.oauth_supported, api_supported = EXCLUDED.api_supported,
  publishing_supported = EXCLUDED.publishing_supported, developer_creation_mode = EXCLUDED.developer_creation_mode,
  automation_policy = EXCLUDED.automation_policy, updated_at = now();
