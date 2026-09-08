-- Semi-automated Google Business review operations. Public reviewer names can
-- suggest a customer match, but never establish identity without human review.
ALTER TABLE business_review ADD COLUMN IF NOT EXISTS sentiment TEXT
  CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','negative'));
ALTER TABLE business_review ADD COLUMN IF NOT EXISTS sentiment_confidence NUMERIC(5,4);
ALTER TABLE business_review ADD COLUMN IF NOT EXISTS sentiment_reason TEXT;
ALTER TABLE business_review ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'new'
  CHECK (workflow_status IN ('new','needs_review','response_approved','responded','dismissed','failed'));
ALTER TABLE business_review ADD COLUMN IF NOT EXISTS response_work_item_id UUID
  REFERENCES marketing_response_work_item(id) ON DELETE SET NULL;

ALTER TABLE marketing_response_work_item ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE marketing_response_work_item ADD COLUMN IF NOT EXISTS source_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_response_work_source
  ON marketing_response_work_item(tenant_id,source_type,source_reference)
  WHERE source_type IS NOT NULL AND source_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS review_customer_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES business_review(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  match_method TEXT NOT NULL CHECK (match_method IN ('display_name_exact','manual')),
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','confirmed','rejected')),
  reviewed_by UUID, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id,customer_id)
);
CREATE INDEX IF NOT EXISTS idx_review_match_review ON review_customer_match(review_id,status,confidence DESC);

CREATE TABLE IF NOT EXISTS reputation_automation_policy (
  tenant_id UUID PRIMARY KEY REFERENCES tenant(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_classify_sentiment BOOLEAN NOT NULL DEFAULT true,
  create_response_work_items BOOLEAN NOT NULL DEFAULT true,
  negative_review_priority TEXT NOT NULL DEFAULT 'high' CHECK (negative_review_priority IN ('low','medium','high','urgent')),
  require_human_reply_approval BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO reputation_automation_policy(tenant_id)
SELECT id FROM tenant ON CONFLICT DO NOTHING;
