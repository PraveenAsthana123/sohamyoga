UPDATE module_registry SET
  built_status = 'partial',
  admin_flow = 'Admin clicks + New Campaign, fills name/type/daily budget, creates a real draft campaign (verified live: POST 201, visible in the Campaigns tab). AI Generate Ad is honestly disabled -- no image-generation service (ComfyUI) is connected.',
  missing_items = 'Campaign creation now real; launching a campaign to a real ad platform (Meta/Google/TikTok) is still not possible -- zero ad-platform API clients exist anywhere, confirmed by grep.',
  source_doc = 'chat session 2026-08-31 fix -- New Campaign button wired to a real POST /api/ads/campaigns',
  last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='paid-ads';

UPDATE module_registry SET
  built_status = 'partial',
  data_flow = 'Real consumer: CampaignAdaptationJob reads the default brand_kit for text/copy tone. NEW: VideoRenderer.ts now also reads the default brand_kit and applies primary_color to the video background and secondary_color to subtitle accent -- verified live by sampling a rendered frame''s actual pixel colour against the brand kit''s hex value (match within H.264 compression tolerance).',
  missing_items = 'Brand kit is now applied to both text copy AND video background/subtitle colour. Logo overlay and font application to video are still not wired.',
  source_doc = 'chat session 2026-08-31 fix -- brand_kit primary/secondary colour now applied to VideoRenderer.ts, live-verified via pixel sampling',
  last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='branding';
