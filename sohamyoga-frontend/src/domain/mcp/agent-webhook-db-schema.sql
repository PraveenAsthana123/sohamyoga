-- Machine/agent-originated MCP calls (e.g. Paperclip's http adapter hitting
-- /api/mcp/agent-webhook) are NOT human identity_account calls, so they
-- don't fit mcp_gateway_audit's called_by/tool_id foreign keys — this is a
-- dedicated, correctly-scoped table rather than forcing that fit.
CREATE TABLE IF NOT EXISTS agent_webhook_call (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_label    TEXT NOT NULL,
  server_slug    TEXT NOT NULL,
  tool_name      TEXT NOT NULL,
  args           JSONB NOT NULL DEFAULT '{}',
  success        BOOLEAN NOT NULL,
  result_summary TEXT,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_webhook_call_recent ON agent_webhook_call(created_at DESC);
