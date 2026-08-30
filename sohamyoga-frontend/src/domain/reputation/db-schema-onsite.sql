-- =============================================================================
-- Review, Rating & Reputation Management — on-site review collection, tied
-- to a real completed booking. Additive to the existing reputation domain
-- folder; does NOT touch google_business_connection/business_review (those
-- are the separate, already-built Google Business Profile sync — external,
-- third-party reviews pulled FROM Google). This is different: the studio's
-- OWN on-site review collection, distinct from Google.
--
-- Integrity control: a review can only be submitted against a real booking
-- row whose status is 'checked_in' (the real signal in booking.status —
-- see src/domain/yoga/db-schema-booking.sql; that table has no separate
-- 'completed' status, checked_in is the real attended-signal) — this
-- prevents review-bombing from people who never attended. One review per
-- booking (UNIQUE constraint), reviewer_email is cross-checked server-side
-- against the real student record tied to that booking, not merely typed
-- in by the requester.
-- =============================================================================

CREATE TYPE service_review_status AS ENUM ('pending', 'published', 'hidden');

CREATE TABLE service_review (
  id                UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID                    NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  booking_id        UUID                    NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  reviewer_name     TEXT                    NOT NULL CHECK (reviewer_name <> ''),
  reviewer_email    TEXT                    NOT NULL,
  star_rating       SMALLINT                NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  comment           TEXT                    NOT NULL DEFAULT '',
  status            service_review_status   NOT NULL DEFAULT 'pending',
  staff_response     TEXT,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX idx_service_review_tenant_status ON service_review(tenant_id, status);
CREATE INDEX idx_service_review_booking ON service_review(booking_id);
