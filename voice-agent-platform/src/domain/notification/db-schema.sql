-- In-app notifications only -- the real, credential-free slice of the
-- "Communication & Notification Layer" concept. SMS/WhatsApp/email/Slack
-- adapters are explicitly NOT built: no third-party credentials exist for
-- any of them, and faking delivery would violate this project's
-- never-fabricate-a-working-feature rule. This table backs real triggers
-- wired into real event paths (see NotificationService.ts).
CREATE TABLE notification (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_kind   TEXT NOT NULL CHECK (recipient_kind IN ('admin', 'business_customer')),
  recipient_id     UUID REFERENCES business_customer(id) ON DELETE CASCADE, -- NULL + kind='admin' means "all admins"
  type             TEXT NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  related_call_id  UUID REFERENCES call_log(id) ON DELETE SET NULL,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (recipient_kind = 'admin' OR recipient_id IS NOT NULL)
);

CREATE INDEX idx_notification_recipient ON notification(recipient_kind, recipient_id, created_at DESC);
CREATE INDEX idx_notification_unread ON notification(recipient_kind, recipient_id) WHERE read_at IS NULL;
