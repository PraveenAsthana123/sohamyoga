-- Lead Score Explainability -- LeadNurturingJob's Ollama prompt already asks
-- for and receives a next_action explanation alongside score/temperature,
-- but it was discarded after generation, never stored. This persists it so
-- the "why" behind a lead's score is visible, not just the number.
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS lead_score_reason TEXT;
