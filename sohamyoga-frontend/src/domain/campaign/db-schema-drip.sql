-- Real internal drip-campaign sequencing. The only "drip" logic that existed
-- before this was LeadNurturingJob's one-shot push of a lead into an
-- external Mautic segment -- no internal multi-step, delayed sequence
-- existed anywhere (confirmed by a full-repo audit). This is a self-
-- contained sequence engine: steps advance for real, on real elapsed time.
-- Actual email delivery still honestly depends on a real SMTP/Novu
-- deployment (neither exists in this environment) -- each step is recorded
-- as 'queued', never fabricated as 'sent', matching the same honesty
-- discipline as NotificationDispatchJob.
CREATE TABLE IF NOT EXISTS drip_sequence (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_step (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES drip_sequence(id) ON DELETE CASCADE,
  step_order  INTEGER NOT NULL CHECK (step_order > 0),
  delay_hours INTEGER NOT NULL CHECK (delay_hours >= 0),
  subject     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  UNIQUE (sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS drip_enrollment (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id      UUID NOT NULL REFERENCES drip_sequence(id) ON DELETE CASCADE,
  lead_id          UUID NOT NULL REFERENCES campaign_lead(id) ON DELETE CASCADE,
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_step     INTEGER NOT NULL DEFAULT 0,
  next_step_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  UNIQUE (sequence_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_drip_enrollment_due ON drip_enrollment(status, next_step_due_at);

CREATE TABLE IF NOT EXISTS drip_send_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id    UUID NOT NULL REFERENCES drip_enrollment(id) ON DELETE CASCADE,
  step_id          UUID NOT NULL REFERENCES drip_step(id),
  recipient_email  VARCHAR(200) NOT NULL,
  subject          VARCHAR(200) NOT NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  queued_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
