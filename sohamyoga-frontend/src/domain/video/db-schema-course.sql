-- Video Course structure -- a real curriculum layer (Course -> Module ->
-- Lesson) wrapping the existing real video_asset pipeline (script generation
-- + espeak-ng/FFmpeg render). Deliberately NOT built on video_edit_project/
-- track/clip (db-schema-editor.sql) -- that schema was confirmed this
-- session to have zero real code consumers anywhere; building on dead
-- schema would just create a second layer of fabrication. A lesson links to
-- a real video_asset row once one is produced; lessons without a video yet
-- are honestly "not_started", not silently hidden.
CREATE TABLE IF NOT EXISTS video_course (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  title         TEXT          NOT NULL CHECK (title <> ''),
  description   TEXT          NOT NULL DEFAULT '',
  status        VARCHAR(20)   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by    TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_course_module (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID        NOT NULL REFERENCES video_course(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL CHECK (title <> ''),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_course_lesson (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id      UUID        NOT NULL REFERENCES video_course_module(id) ON DELETE CASCADE,
  video_asset_id UUID        REFERENCES video_asset(id) ON DELETE SET NULL,
  title          TEXT        NOT NULL CHECK (title <> ''),
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_course_tenant       ON video_course (tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_course_module_course ON video_course_module (course_id);
CREATE INDEX IF NOT EXISTS idx_video_course_lesson_module ON video_course_lesson (module_id);
CREATE INDEX IF NOT EXISTS idx_video_course_lesson_video   ON video_course_lesson (video_asset_id);
