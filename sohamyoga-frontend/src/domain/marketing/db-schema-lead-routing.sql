-- Lead Routing Engine + Lead SLA Control -- campaign_lead had no assignment
-- or response-time-target concept at all. assigned_to enables real
-- round-robin distribution among active staff; sla_deadline (set at
-- creation) enables a real, checkable breach detection instead of a
-- fabricated "SLA compliance %" with nothing behind it.
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES app_user(id);
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_campaign_lead_assigned ON campaign_lead (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_lead_sla ON campaign_lead (sla_deadline) WHERE sla_deadline IS NOT NULL;
