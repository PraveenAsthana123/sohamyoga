-- Service Recovery -- a real, trackable case opened automatically whenever
-- a genuinely low-star (<=2) service_review is submitted. No AI decides
-- resolution -- a human records contact_method/notes/resolved_at, same
-- "record, don't fabricate" discipline as every other closure this session.
CREATE TABLE IF NOT EXISTS service_recovery_case (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  review_id      UUID          NOT NULL REFERENCES service_review(id) ON DELETE CASCADE,
  status         VARCHAR(20)   NOT NULL DEFAULT 'identified'
                   CHECK (status IN ('identified','contacted','resolved','unresolved')),
  contact_method VARCHAR(20)   CHECK (contact_method IN ('phone','email','in_person')),
  notes          TEXT,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (review_id)
);

CREATE INDEX IF NOT EXISTS idx_recovery_tenant ON service_recovery_case (tenant_id, status);
