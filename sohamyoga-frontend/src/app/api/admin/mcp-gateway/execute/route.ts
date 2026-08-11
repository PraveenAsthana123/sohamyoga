import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { routeTool } from '@/domain/mcp/gateway-registry';
import { isExecutable, executeExternalPlatformTool } from '@/domain/mcp/external-platform-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real execution endpoint, deliberately narrow: only tools with
 * tier='auto' AND a real working implementation (no credentials needed)
 * actually run. Everything else — including every write-capable tool in
 * the external-platform registry — returns an honest "not executable"
 * response rather than a fake success, per the "no autonomous publishing
 * without human approval" rule this gateway's own manifests already state.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { serverSlug?: string; toolName?: string; args?: Record<string, unknown> } | null;
  if (!body?.serverSlug || !body.toolName) {
    return Response.json({ error: 'serverSlug and toolName are required' }, { status: 400 });
  }

  const route = routeTool(body.toolName);
  if (!route) return Response.json({ error: `Unknown tool: ${body.toolName}` }, { status: 404 });
  if (route.server.slug !== body.serverSlug) {
    return Response.json({ error: `Tool ${body.toolName} belongs to ${route.server.slug}, not ${body.serverSlug}` }, { status: 400 });
  }
  if (route.tier !== 'auto') {
    return Response.json({ error: `Tool tier is '${route.tier}' — requires human approval, cannot execute directly through this endpoint.` }, { status: 403 });
  }
  if (!isExecutable(body.serverSlug, body.toolName)) {
    return Response.json({ executed: false, reason: 'This tool needs credentials not configured in this environment.' });
  }

  const result = await executeExternalPlatformTool(body.serverSlug, body.toolName, body.args ?? {});
  return Response.json(result);
}
