-- Third cataloging batch, 2026-08-31: deep skeptical re-audit of Ads
-- Management + 8 platform/comms modules. Corrects two earlier WRONG
-- classifications (paid-ads, campaign-management were marked 'real' from a
-- shallow "admin page exists" check; deep audit found zero real
-- creation/launch path for either) — same honesty discipline as the earlier
-- Poll Management correction, applied to my own prior mistakes this time.

-- CORRECTION: paid-ads was wrongly 'real'.
UPDATE module_registry SET
  built_status = 'partial',
  admin_flow = 'Admin views Overview/Campaigns/Ad Groups/Creatives/Health/Analytics tabs — all real, API-backed reads. But the "+ New Campaign" and "AI Generate Ad" buttons have no onClick handler at all (dead decoration); the Integrations tab (MCP tools, Google Ads API clients) is hardcoded display text, not a real connection check.',
  data_flow = 'ad_campaign/ad_group/advertisement/ad_keyword are real tables with real reporting queries, but grep-confirmed only 2 real INSERT INTO ad_campaign call sites exist in the whole repo: a demo-seeder route and the health-audit job (which only writes findings, never campaigns). No route, form, or code path lets a real user create a campaign.',
  job_name = 'campaign-health-audit',
  missing_items = 'No campaign/ad-group/creative creation flow exists anywhere (the primary CTAs are dead buttons). Zero real Meta/Google/TikTok/LinkedIn ad-platform API clients exist in the repo (grep-confirmed) — even if creation existed, nothing would actually launch to a real platform. KPI math (CTR/CPC/CPA) is real SQL, but can only ever reflect manually-seeded demo data.',
  source_doc = 'deep re-audit 2026-08-31 (corrects the earlier shallow real classification)',
  last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='paid-ads';

-- New: dedicated Google Ads finding (distinct from the generic ads schema).
INSERT INTO module_registry (app, module_key, name, built_status, missing_items, source_doc, last_verified_at, verified_by)
VALUES ('sohamyoga-frontend', 'google-ads', 'Google Ads (platform-specific)', 'not_built',
 'Zero Google Ads API client code anywhere (grep-confirmed: googleads/google-ads-api/GoogleAdsApi = 0 hits). Only artifacts: a lead-source enum value and a disabled feature flag whose own description says "Requires Google Ads developer token." No admin page or route specific to Google Ads.',
 'deep re-audit 2026-08-31', now(), 'claude-session-339c0b70')
ON CONFLICT (app, module_key) DO UPDATE SET built_status=EXCLUDED.built_status, missing_items=EXCLUDED.missing_items, source_doc=EXCLUDED.source_doc, last_verified_at=now();

-- Upgrade reputation-management to full detail — this is a genuine second
-- fully-real, end-to-end module (real OAuth + real Google Business API calls).
UPDATE module_registry SET
  built_status = 'real',
  description = 'Google Business Profile review sync and reply, via a real OAuth connection.',
  user_flow = 'No direct end-user surface — this manages the business''s own Google Business reviews.',
  admin_flow = 'Admin connects a Google Business account via real OAuth (consent screen redirect + code exchange), syncs reviews, replies to a review from the admin UI.',
  data_flow = 'OAuth connect -> google_business_connection stores per-tenant client credentials -> sync calls real mybusiness.googleapis.com endpoints -> business_review rows populated -> admin reply calls the real reply API.',
  flowchart = 'Admin clicks Connect -> Google consent screen -> oauth/callback exchanges code -> google_business_connection row -> Sync -> GoogleBusinessReviewAdapter.ts calls real Google APIs -> business_review rows -> admin replies -> real API call back to Google',
  user_story = 'As a business owner, I want to see and respond to my real Google reviews from one place, so I do not have to log into Google separately.',
  input_desc = 'A Google Business OAuth connection (per-tenant client credentials, BYO OAuth app).',
  process_desc = 'Real fetch() calls to mybusinessaccountmanagement/mybusinessbusinessinformation/mybusiness.googleapis.com — list accounts/locations/reviews, reply to a review. Fails closed (409/422) if not connected, never fabricates review data.',
  output_desc = 'Real business_review rows and real reply delivery back to Google.',
  final_outcome = 'A synced, responded-to review — genuinely reflected on the business''s real Google listing.',
  report_location = '/admin/reputation', dashboard_location = '/admin/reputation',
  schema_tables = ARRAY['business_review','google_business_connection'],
  missing_items = 'Full flow verified via code reading, not a live OAuth round-trip (would need real Google credentials to test end-to-end in this session).',
  source_doc = 'deep re-audit 2026-08-31', last_verified_at = now(), verified_by = 'claude-session-339c0b70'
WHERE app='sohamyoga-frontend' AND module_key='reputation-management';

-- Upgrade email-management with the real finding: real dispatch client, but
-- unreachable in this environment (no Novu deployed, no API key), plus one
-- confirmed-dead UI button.
UPDATE module_registry SET
  built_status = 'partial',
  process_desc = 'NotificationDispatchJob.ts makes a real POST to a self-hosted Novu instance (/v1/events/trigger) — a genuine delivery attempt with retry on failure, not a status-flip. But no Novu instance is deployed anywhere in this repo and NOVU_API_KEY is unset, so every dispatch currently fails at the credential gate.',
  missing_items = 'Novu is not deployed and NOVU_API_KEY is unset — real code, no working delivery in this environment. Separately, the admin "Test SMTP" button (src/app/admin/config/page.tsx) calls POST /api/home/test-email, which does not exist as a route at all — that specific button is dead/broken code, not just gated.',
  source_doc = 'deep re-audit 2026-08-31', last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='email-management';

-- Correction: campaign-management was wrongly 'real' — launch is a pure
-- status flip with zero send-side-effect.
UPDATE module_registry SET
  built_status = 'partial',
  admin_flow = 'Admin views campaign briefs on /admin/campaigns, clicks Launch/Pause.',
  data_flow = 'The launch/pause API route (src/app/api/lifecycle-campaigns/[id]/route.ts, explicitly commented "status transitions only") does exactly: UPDATE lifecycle_campaign SET status=$1 WHERE id=$2. No insert into notification_queue, no call to any dispatch job or Postiz — launching a campaign has zero real send-side-effect.',
  schema_tables = ARRAY['lifecycle_campaign','campaign_brief','campaign_analytics'],
  missing_items = 'Launch/Pause only flips a status column — no real email/notification/social dispatch is triggered by launching a campaign. Same pattern as Ads Management (real CRUD, no real action on the primary button).',
  source_doc = 'deep re-audit 2026-08-31 (corrects the earlier real classification)', last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='campaign-management';

-- New rows: YouTube/Facebook/LinkedIn/Telegram — all share the same root
-- blocker (real Postiz client code, no deployed Postiz instance / API key),
-- Telegram is a special case (real, tested, callable function with zero
-- production callers wired to it).
INSERT INTO module_registry (app, module_key, name, built_status, admin_flow, data_flow, missing_items, source_doc, last_verified_at, verified_by)
VALUES
('sohamyoga-frontend', 'youtube-management', 'YouTube Management (organic posting)', 'partial',
 'Admin configures social credentials; publishing is automatic via a cron job once approved content exists.',
 'PostizSocialAutoPublishJob.ts (real, registered) builds a YouTube-specific payload (title/visibility/tags/media) and POSTs to a self-hosted Postiz instance, updating social_post/social_platform_variant on success/failure.',
 'Real code, gated on POSTIZ_PUBLIC_API_KEY (unset) and a deployed Postiz instance (not present in this repo) — currently non-functional for lack of infrastructure, not mocked.',
 'deep re-audit 2026-08-31', now(), 'claude-session-339c0b70'),
('sohamyoga-frontend', 'facebook-management', 'Facebook Management (organic posting)', 'partial',
 'Same as YouTube — automatic via the shared Postiz job once content is approved.',
 'Same PostizSocialAutoPublishJob.ts path (facebook is in AUTOMATED_POSTIZ_PLATFORMS). Note: an older single-platform FacebookAutoPublishJob.ts also exists but is never registered in jobModules.ts/CronRegistry.ts — dead, superseded code.',
 'Same Postiz credential/deployment gap as YouTube.',
 'deep re-audit 2026-08-31', now(), 'claude-session-339c0b70'),
('sohamyoga-frontend', 'linkedin-management', 'LinkedIn Management (posting/automation)', 'partial',
 'Same shared Postiz job — no dedicated LinkedIn admin flow.',
 'linkedin is in AUTOMATED_POSTIZ_PLATFORMS; posting delegated entirely to Postiz. No direct LinkedIn API client exists in this repo at all (grep-confirmed).',
 'Only works if/when Postiz itself is deployed and holds a LinkedIn OAuth token — this app has no fallback direct integration.',
 'deep re-audit 2026-08-31', now(), 'claude-session-339c0b70'),
('sohamyoga-frontend', 'telegram-management', 'Telegram Management', 'partial',
 'Admin captures a bot token via credentials UI.',
 'src/domain/social/first-wave-adapters.ts has a real, unit-tested fetch() call to api.telegram.org/bot<token>/sendMessage. But grep confirms zero production callers — no cron job or API route ever invokes it.',
 'A real, correct, tested bot integration that nothing in the app actually calls — needs wiring to a real trigger (e.g. the same publish pipeline as other platforms), not new API code.',
 'deep re-audit 2026-08-31', now(), 'claude-session-339c0b70')
ON CONFLICT (app, module_key) DO UPDATE SET
  built_status=EXCLUDED.built_status, admin_flow=EXCLUDED.admin_flow, data_flow=EXCLUDED.data_flow,
  missing_items=EXCLUDED.missing_items, source_doc=EXCLUDED.source_doc, last_verified_at=now();
