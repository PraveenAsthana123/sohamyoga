-- Scripts need to be organized by call direction (inbound vs outbound) and
-- by scenario, not just by clinic service_type -- the user asked for "a
-- list of scenarios" for each direction. scenario_key is a free-form slug
-- (not an enum) since the scenario list is expected to grow.
CREATE TYPE call_script_direction AS ENUM ('inbound', 'outbound');
ALTER TABLE call_script ADD COLUMN IF NOT EXISTS direction call_script_direction NOT NULL DEFAULT 'outbound';
ALTER TABLE call_script ADD COLUMN IF NOT EXISTS scenario_key TEXT;
CREATE INDEX IF NOT EXISTS idx_call_script_direction ON call_script(direction);
