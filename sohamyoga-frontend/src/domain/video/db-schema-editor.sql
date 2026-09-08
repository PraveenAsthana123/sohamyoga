-- Non-destructive editing model. Rendering adapters (FFmpeg/HyperFrames/provider)
-- consume frozen snapshots; they do not mutate the edit while a render runs.
CREATE TABLE IF NOT EXISTS video_edit_project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
  title TEXT NOT NULL, aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9','9:16','1:1','4:5')),
  width INTEGER NOT NULL DEFAULT 1920 CHECK (width BETWEEN 240 AND 7680),
  height INTEGER NOT NULL DEFAULT 1080 CHECK (height BETWEEN 240 AND 7680),
  fps NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (fps BETWEEN 1 AND 120),
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','rendering','complete','failed','archived')),
  creative_brief TEXT NOT NULL DEFAULT '', prompt_instructions TEXT NOT NULL DEFAULT '',
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_edit_project_tenant ON video_edit_project(tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS video_edit_track (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES video_edit_project(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('video','image','text','caption','voice','music','sfx','shape','three_d','hologram')),
  name TEXT NOT NULL, sort_order INTEGER NOT NULL, muted BOOLEAN NOT NULL DEFAULT false, locked BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(project_id, sort_order)
);
CREATE TABLE IF NOT EXISTS video_edit_clip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), track_id UUID NOT NULL REFERENCES video_edit_track(id) ON DELETE CASCADE,
  asset_uri TEXT, start_ms BIGINT NOT NULL CHECK (start_ms >= 0), end_ms BIGINT NOT NULL,
  source_in_ms BIGINT NOT NULL DEFAULT 0, properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (end_ms > start_ms)
);
CREATE INDEX IF NOT EXISTS idx_video_edit_clip_timeline ON video_edit_clip(track_id, start_ms, end_ms);

CREATE TABLE IF NOT EXISTS video_render_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES video_edit_project(id) ON DELETE CASCADE,
  engine TEXT NOT NULL CHECK (engine IN ('ffmpeg','hyperframes','provider')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  snapshot JSONB NOT NULL, output_uri TEXT, checksum_sha256 TEXT, error_code TEXT, error_detail TEXT,
  attempts INTEGER NOT NULL DEFAULT 0, queued_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_video_render_job_queue ON video_render_job(status, queued_at);

CREATE TABLE IF NOT EXISTS video_project_event (
  id BIGSERIAL PRIMARY KEY, project_id UUID NOT NULL REFERENCES video_edit_project(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, actor_id UUID, correlation_id TEXT, detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_project_event_project ON video_project_event(project_id, created_at DESC);
