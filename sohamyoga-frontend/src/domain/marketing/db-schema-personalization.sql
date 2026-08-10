-- Segment-personalized campaign content. Backward compatible: a request with
-- no target_segments behaves exactly as before (one generic asset set).
-- With target_segments set, MarketingAutomationJob generates one distinct,
-- Ollama-personalized asset set PER segment instead of a single generic one.

ALTER TABLE marketing_automation_request ADD COLUMN IF NOT EXISTS target_segments TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE generated_marketing_asset ADD COLUMN IF NOT EXISTS segment_key TEXT;

-- Re-declared with target_segments appended at the end (CREATE OR REPLACE VIEW
-- can only append columns, not insert them positionally into an existing view).
CREATE OR REPLACE VIEW v_marketing_automation_dashboard AS
SELECT r.id, r.tenant_id, r.title, r.industry, r.objective, r.asset_types,
       r.channels, r.scheduled_at, r.status, r.progress_percent, r.current_stage,
       r.model_name, r.error_message, r.created_at, r.updated_at,
       COUNT(a.id) AS asset_count,
       COUNT(a.id) FILTER (WHERE a.status = 'approved') AS approved_asset_count,
       r.target_segments
FROM marketing_automation_request r
LEFT JOIN generated_marketing_asset a ON a.request_id = r.id
GROUP BY r.id;
