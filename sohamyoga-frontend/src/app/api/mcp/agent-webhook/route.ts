import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { routeTool } from '@/domain/mcp/gateway-registry';
import { isExecutable, executeExternalPlatformTool } from '@/domain/mcp/external-platform-mcp';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Machine-to-machine entry point for external orchestrators (Paperclip's
// http adapter, or any future agent runtime) that cannot hold an admin
// session cookie. Auth is a shared secret compared with timingSafeEqual
// (not `===`, which leaks timing information byte-by-byte), not a weaker
// substitute for admin auth — it enforces the exact same tier='auto' +
// isExecutable gates as the human-facing /api/admin/mcp-gateway/execute
// route. Every call — success or failure — is recorded in
// agent_webhook_call so an agent-originated action is never invisible.
function secretMatches(provided: string | null): boolean {
  const expected = process.env.AGENT_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get('x-agent-webhook-secret'))) {
    return Response.json({ error: 'Invalid or missing webhook secret.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { agentId?: string; runId?: string; context?: { serverSlug?: string; toolName?: string; args?: Record<string, unknown> } } | null;
  const serverSlug = body?.context?.serverSlug;
  const toolName = body?.context?.toolName;
  const args = body?.context?.args ?? {};
  const agentLabel = body?.agentId ?? 'unknown-agent';

  if (!serverSlug || !toolName) {
    return Response.json({ error: 'context.serverSlug and context.toolName are required.' }, { status: 400 });
  }

  const route = routeTool(toolName);
  const logResult = async (success: boolean, resultSummary?: string, errorMessage?: string) => {
    await query(
      `INSERT INTO agent_webhook_call (agent_label, server_slug, tool_name, args, success, result_summary, error_message) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [agentLabel, serverSlug, toolName, JSON.stringify(args), success, resultSummary ?? null, errorMessage ?? null],
    );
  };

  if (!route) {
    await logResult(false, undefined, `Unknown tool: ${toolName}`);
    return Response.json({ error: `Unknown tool: ${toolName}` }, { status: 404 });
  }
  if (route.server.slug !== serverSlug) {
    await logResult(false, undefined, `Tool ${toolName} belongs to ${route.server.slug}, not ${serverSlug}`);
    return Response.json({ error: `Tool ${toolName} belongs to ${route.server.slug}, not ${serverSlug}` }, { status: 400 });
  }
  if (route.tier !== 'auto') {
    await logResult(false, undefined, `Tier '${route.tier}' requires human approval — agents cannot call this directly.`);
    return Response.json({ error: `Tool tier is '${route.tier}' — requires human approval.` }, { status: 403 });
  }
  if (!isExecutable(serverSlug, toolName)) {
    await logResult(false, 'not_executable — credentials not configured');
    return Response.json({ executed: false, reason: 'This tool needs credentials not configured in this environment.' });
  }

  try {
    const result = await executeExternalPlatformTool(serverSlug, toolName, args);
    await logResult(true, JSON.stringify(result).slice(0, 500));
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logResult(false, undefined, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
