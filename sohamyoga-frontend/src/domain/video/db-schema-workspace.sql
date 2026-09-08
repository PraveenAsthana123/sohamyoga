ALTER TABLE video_edit_project ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customer(id);
ALTER TABLE video_edit_project ADD COLUMN IF NOT EXISTS delivery_url TEXT;
ALTER TABLE video_edit_project ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT '';
ALTER TABLE video_edit_project ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE video_edit_project ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_video_edit_customer ON video_edit_project(customer_id, updated_at DESC);
