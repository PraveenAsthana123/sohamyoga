-- =============================================================================
-- Customer self-service referral (closes the previously-explicit "no public
-- customer-facing referral/share UI" boundary, at the user's request).
--
-- Adds the AI-drafted invitation text a customer sees alongside their own
-- referral code on /customer/referral. Kept as columns on referral_code
-- rather than a new table: one active code per customer in this v1 (see
-- ReferralInvitationJob.ts), so the 1:1 relationship needs no join table.
-- =============================================================================

ALTER TABLE referral_code ADD COLUMN IF NOT EXISTS invitation_draft TEXT;
ALTER TABLE referral_code ADD COLUMN IF NOT EXISTS invitation_drafted_at TIMESTAMPTZ;
