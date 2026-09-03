-- Web Push subscription store. Backs the 'push' channel already reserved in
-- ref_notification_channel and notification_preference.push_enabled (see
-- db-schema.sql) but previously had nowhere to persist an actual browser
-- subscription -- PushManager/push_subscription had zero hits anywhere in
-- this repo before this migration.
--
-- user_id is the auth principal id (matches notification_preference.user_id
-- and customer.user_id), not customer_id -- consistent with how the rest of
-- the notification domain keys on the caller's own account, not the
-- yoga-specific customer profile. No local FK: the user record lives in the
-- external auth service, same as notification_preference.user_id.
--
-- One browser/device = one row (endpoint is unique per browser+device+origin
-- combination, issued by the browser's push service). A user can have many
-- rows (phone, laptop, ...); all are sent to on every push.
CREATE TABLE IF NOT EXISTS push_subscription (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  user_id      UUID         NOT NULL,
  endpoint     TEXT         NOT NULL,
  p256dh       TEXT         NOT NULL,   -- subscription.keys.p256dh
  auth         TEXT         NOT NULL,   -- subscription.keys.auth
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscription_user ON push_subscription (tenant_id, user_id);
