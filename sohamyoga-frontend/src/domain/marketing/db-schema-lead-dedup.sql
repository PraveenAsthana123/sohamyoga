-- Lead Deduplication: confirmed zero dedup logic existed across all 4 real
-- campaign_lead entry points (contact form, event registration, form
-- submissions, demo seed) before this. A real routing/owner-assignment
-- layer is NOT added here -- no real staff/sales-rep table exists in this
-- Postgres DB to route to (identity/roles live in the separate .NET
-- backend), so fabricating round-robin assignment to invented names would
-- be dishonest. Dedup only, honestly scoped.

ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID REFERENCES campaign_lead (id);
CREATE INDEX IF NOT EXISTS idx_campaign_lead_duplicate ON campaign_lead (duplicate_of_lead_id) WHERE duplicate_of_lead_id IS NOT NULL;
