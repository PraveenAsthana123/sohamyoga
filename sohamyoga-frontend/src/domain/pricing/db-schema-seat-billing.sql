-- Seat-Based Billing -- Subscription.addFamilySeat()/removeFamilySeat() were
-- real, already-implemented domain methods (seat-limit invariant, duplicate
-- check) with zero API route ever calling them; family_seat had zero rows.
-- No plan carried a real seat limit to enforce against, so this adds one --
-- 1 (no extra seats) by default, 4 for the existing family plan_type.
ALTER TABLE pricing_plan_master ADD COLUMN IF NOT EXISTS max_family_seats SMALLINT NOT NULL DEFAULT 1 CHECK (max_family_seats >= 1);
UPDATE pricing_plan_master SET max_family_seats = 4 WHERE plan_type = 'family' AND max_family_seats = 1;
