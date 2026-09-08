import { NextRequest } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildVapiMcpServer } from '@/domain/mcp/VapiMcpServer';

/**
 * Real MCP-protocol endpoint (JSON-RPC per the Model Context Protocol spec),
 * meant to be registered as an upstream Gateway in IBM ContextForge -- NOT
 * meant to be reachable directly by end users. Verifies a shared secret
 * (x-mcp-secret) the same way the Vapi webhook receiver does: fails closed
 * if MCP_SERVER_SECRET is unset or the header doesn't match, rather than
 * trusting an unauthenticated caller to invoke real tools (including
 * sync_script_to_vapi and the confirmation-gated place_call).
 *
 * Stateless mode (sessionIdGenerator: undefined) -- a fresh server+transport
 * per request, matching how Next.js route handlers already work (no
 * persistent process to hold SSE session state across requests).
 */
export async function POST(req: NextRequest) {
  const configuredSecret = process.env.MCP_SERVER_SECRET?.trim();
  if (!configuredSecret) {
    return new Response(JSON.stringify({ error: 'MCP_SERVER_SECRET is not configured -- refusing to serve MCP requests.' }), { status: 503 });
  }
  const receivedSecret = req.headers.get('x-mcp-secret');
  if (receivedSecret !== configuredSecret) {
    return new Response(JSON.stringify({ error: 'Invalid MCP secret.' }), { status: 401 });
  }

  const initiatedBy = req.headers.get('x-mcp-caller') || 'unknown';
  const server = buildVapiMcpServer(initiatedBy);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}
