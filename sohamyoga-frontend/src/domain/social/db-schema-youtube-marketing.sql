-- Postiz YouTube uploads require an already-ingested MP4 media object and
-- provider-specific metadata. Store identifiers/paths only, never OAuth tokens.
ALTER TABLE social_platform_variant ADD COLUMN IF NOT EXISTS video_title TEXT;
ALTER TABLE social_platform_variant ADD COLUMN IF NOT EXISTS postiz_media_id TEXT;
ALTER TABLE social_platform_variant ADD COLUMN IF NOT EXISTS postiz_media_path TEXT;
ALTER TABLE social_platform_variant ADD COLUMN IF NOT EXISTS youtube_visibility TEXT NOT NULL DEFAULT 'unlisted'
  CHECK (youtube_visibility IN ('public','private','unlisted'));
ALTER TABLE social_platform_variant ADD COLUMN IF NOT EXISTS youtube_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE social_platform_variant ADD CONSTRAINT youtube_video_requirements CHECK (
  platform <> 'youtube' OR status IN ('failed','skipped') OR
  (video_title IS NOT NULL AND char_length(video_title) BETWEEN 2 AND 100 AND postiz_media_id IS NOT NULL AND postiz_media_path ~* '\.mp4([?#].*)?$')
) NOT VALID;
