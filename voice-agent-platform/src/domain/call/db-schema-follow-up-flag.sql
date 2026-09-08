-- Real "human in the loop required" flag per call, per explicit business-
-- customer dashboard request (who was called, duration, what was
-- discussed, and whether a human needs to follow up). Defaults false;
-- staff/logging flow sets it true when a call's outcome needs a real
-- person to act on it -- never auto-inferred without a human decision.
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS needs_follow_up BOOLEAN NOT NULL DEFAULT FALSE;
