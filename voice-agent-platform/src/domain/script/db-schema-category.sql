-- Real, minimal slice of "outbound script library" (Topic J): a category
-- tag so scripts can be grouped/filtered, without building a fabricated
-- audience-segmentation Campaign Manager on top of contacts that don't
-- carry segment data yet.
ALTER TABLE call_script ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_call_script_category ON call_script(category);
