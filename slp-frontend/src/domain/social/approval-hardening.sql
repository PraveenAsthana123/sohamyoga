ALTER TABLE social_mcp_approval_log ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
ALTER TABLE social_mcp_approval_log ADD COLUMN IF NOT EXISTS consumed_by UUID;
CREATE INDEX IF NOT EXISTS idx_social_approval_valid ON social_mcp_approval_log(approval_token,draft_id,expires_at) WHERE status='approved' AND consumed_at IS NULL;
