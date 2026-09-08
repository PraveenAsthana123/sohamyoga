-- Trigger Management -- lifecycle_campaign.campaign_type already had a real
-- 'trigger' value but nothing ever bound it to an actual event or executed
-- it. trigger_event references the real journey_touchpoint_type enum
-- (the only real event stream this product has), so a trigger campaign is
-- always grounded in something that actually happens.
ALTER TABLE lifecycle_campaign ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(40);
ALTER TABLE lifecycle_campaign ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lifecycle_campaign_trigger_log (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID          NOT NULL REFERENCES lifecycle_campaign(id) ON DELETE CASCADE,
  touchpoint_id     UUID          NOT NULL REFERENCES journey_touchpoint(id) ON DELETE CASCADE,
  fired_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, touchpoint_id)
);
