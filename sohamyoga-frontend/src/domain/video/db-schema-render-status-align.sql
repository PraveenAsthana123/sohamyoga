-- Reconcile the video_render_status enum and script-approval audit columns
-- with VideoAsset.ts's already-built, validated render-lifecycle domain
-- model (queueRender/beginRendering/completeRender/failRender). That class
-- was written against a 5-state render model ('none'/'queued'/'rendering'/
-- 'complete'/'failed') and 3 script-audit fields (scriptGeneratedAt/
-- scriptApprovedAt/scriptApprovedBy) that never matched migration 111's
-- 4-state enum and missing columns -- the domain class was fully
-- implemented but had zero real callers until this pass wired it up.

ALTER TYPE video_render_status RENAME VALUE 'not_started' TO 'none';
ALTER TYPE video_render_status ADD VALUE 'queued' AFTER 'none';
ALTER TABLE video_asset ALTER COLUMN render_status SET DEFAULT 'none';

ALTER TABLE video_asset ADD COLUMN script_generated_at TIMESTAMPTZ;
ALTER TABLE video_asset ADD COLUMN script_approved_at TIMESTAMPTZ;
ALTER TABLE video_asset ADD COLUMN script_approved_by TEXT;
