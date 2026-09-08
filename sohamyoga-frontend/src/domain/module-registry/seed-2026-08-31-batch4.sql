INSERT INTO module_registry (app, module_key, name, built_status, admin_flow, data_flow, missing_items, has_user_ui, has_admin_ui, schema_tables, source_doc, last_verified_at, verified_by)
VALUES
('sohamyoga-frontend', 'branding', 'Branding (Brand Kits)', 'partial',
 'Admin creates/edits a brand kit (tone words, hashtags, default flag) at /admin/brand-kits, real POST/PATCH.',
 'Real consumer: CampaignAdaptationJob reads the default brand_kit and feeds tone/hashtags into Ollama to adapt campaign copy per platform -- genuine, working, end-to-end, but text only. Zero use of brand_kit in any video/image generation path.',
 'Brand kit is applied to social copy adaptation only -- never reaches video/image rendering, so a client demo of on-brand video would not reflect the brand kit at all.',
 false, true, ARRAY['brand_kit'], 'deep audit 2026-08-31', now(), 'claude-session-339c0b70'),
('sohamyoga-frontend', 'video-editing', 'Video Editing (multi-clip/timeline)', 'not_built',
 'Admin can generate-script -> approve -> render -> publish/archive a single video.', 'Render-only: one ffmpeg call per video (background + TTS audio + subtitles + optional watermark). No concat/xfade/trim -- confirmed zero real editing capability in either app via grep.',
 'This is TTS-to-video generation, not editing. No timeline, no clip list, no cut/trim/transition controls exist anywhere.',
 false, true, ARRAY[]::text[], 'deep audit 2026-08-31', now(), 'claude-session-339c0b70'),
('sohamyoga-frontend', 'audio-editing', 'Audio Editing', 'not_built',
 NULL, 'Only audio path in either app: a single espeak-ng TTS call piped straight into ffmpeg with zero further processing (no gain/fade/mix/noise-reduction filters found anywhere).',
 'No mixing, trimming, noise removal, or multi-track capability exists at all -- confirmed by grep across both apps.',
 false, false, ARRAY[]::text[], 'deep audit 2026-08-31', now(), 'claude-session-339c0b70')
ON CONFLICT (app, module_key) DO UPDATE SET built_status=EXCLUDED.built_status, missing_items=EXCLUDED.missing_items, last_verified_at=now();
