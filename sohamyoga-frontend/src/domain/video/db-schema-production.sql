-- Scoped video production: real script generation (human-approved before use)
-- + real faceless-video rendering (TTS + FFmpeg, ported from
-- market-research-portal's real VideoRenderer.ts). Additive only.
-- Explicitly NOT the 774-item "Video Production Studio" fantasy audited and
-- rejected earlier this session -- just: script -> approve -> render -> catalog.

ALTER TABLE video_asset ALTER COLUMN source_url DROP NOT NULL;

CREATE TYPE video_script_status AS ENUM ('none', 'draft', 'approved');
CREATE TYPE video_render_status AS ENUM ('not_started', 'rendering', 'complete', 'failed');

ALTER TABLE video_asset ADD COLUMN script TEXT;
ALTER TABLE video_asset ADD COLUMN hook_lines TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE video_asset ADD COLUMN script_status video_script_status NOT NULL DEFAULT 'none';
ALTER TABLE video_asset ADD COLUMN render_status video_render_status NOT NULL DEFAULT 'not_started';
ALTER TABLE video_asset ADD COLUMN render_error TEXT;
ALTER TABLE video_asset ADD COLUMN render_checksum_sha256 TEXT;
ALTER TABLE video_asset ADD COLUMN render_duration_seconds NUMERIC(8,2);
ALTER TABLE video_asset ADD COLUMN rendered_at TIMESTAMPTZ;
