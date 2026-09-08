-- Closes: "Content Factory types are video-only -- no blog/whitepaper/
-- case-study content types." content_factory_project.content_type is a
-- REQUIRED FK to content_factory_type, whose 15 seeded rows (devotional,
-- educational, meme, ...) are all video *genres*, not mediums -- there was
-- no column distinguishing "this project is a blog post" from "this
-- project is a video". Additive, not a rename: content_type/duration_
-- seconds/aspect_ratio stay exactly as-is for existing (all-video) rows;
-- they just become optional so a blog/whitepaper/case_study project isn't
-- forced to reference an irrelevant video genre or carry a fake duration.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_factory_project' AND column_name = 'content_medium'
  ) THEN
    ALTER TABLE content_factory_project
      ADD COLUMN content_medium TEXT NOT NULL DEFAULT 'video'
        CHECK (content_medium IN ('video','blog','whitepaper','case_study'));
  END IF;
END $$;

ALTER TABLE content_factory_project ALTER COLUMN content_type DROP NOT NULL;
ALTER TABLE content_factory_project ALTER COLUMN duration_seconds DROP NOT NULL;
ALTER TABLE content_factory_project ALTER COLUMN duration_seconds DROP DEFAULT;
ALTER TABLE content_factory_project ALTER COLUMN aspect_ratio DROP NOT NULL;
ALTER TABLE content_factory_project ALTER COLUMN aspect_ratio DROP DEFAULT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'content_factory_project' AND constraint_name = 'content_factory_project_video_fields_chk'
  ) THEN
    ALTER TABLE content_factory_project
      ADD CONSTRAINT content_factory_project_video_fields_chk
      CHECK (content_medium <> 'video' OR (content_type IS NOT NULL AND duration_seconds IS NOT NULL AND aspect_ratio IS NOT NULL));
  END IF;
END $$;
