import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { routeTool } from '@/domain/mcp/gateway-registry';
import { isExecutable, executeExternalPlatformTool } from '@/domain/mcp/external-platform-mcp';
import { isInternalToolExecutable, executeInternalTool } from '@/domain/mcp/internal-tool-execution';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';

// Real audit trail for mcp_tool_call -- previously the execute route ran
// tools but never logged a single row, so no "report" of what was actually
// called was ever possible (found live during the 2026-09-01 admin-panel
// tab-standard build). mcp_server itself was also never seeded (0 rows),
// so this upserts a matching row by slug before logging, self-healing
// rather than requiring a separate seed migration.
async function ensureServerRow(slug: string, name: string, toolCount: number): Promise<string | null> {
  if (!databaseConfigured()) return null;
  const result = await query<{ id: string }>(
    `INSERT INTO mcp_server (tenant_id, name, slug, version, endpoint, status, tool_count, is_enabled)
     VALUES ($1,$2,$3,'1.0.0','in-process','online',$4,true)
     ON CONFLICT (tenant_id, slug) DO UPDATE SET tool_count = EXCLUDED.tool_count, last_checked_at = now()
     RETURNING id`,
    [DEMO_TENANT_ID, name, slug, toolCount],
  ).catch(() => null);
  return result?.rows[0]?.id ?? null;
}

/**
 * Real execution endpoint, deliberately narrow: only tools with
 * tier='auto' AND a real working implementation (no credentials needed)
 * actually run. Everything else — including every write-capable tool in
 * the external-platform registry — returns an honest "not executable"
 * response rather than a fake success, per the "no autonomous publishing
 * without human approval" rule this gateway's own manifests already state.
 */
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
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

  const serverId = await ensureServerRow(route.server.slug, route.server.name, route.server.tools.length);
  const logCall = async (status: 'success' | 'failed' | 'rejected', durationMs: number | null, errorMessage: string | null) => {
    if (!serverId || !databaseConfigured()) return;
    await query(
      `INSERT INTO mcp_tool_call (tenant_id, server_id, tool_name, tier, status, actor_id, actor_role, duration_ms, error_message, rejection_reason)
       VALUES ($1,$2,$3,$4,$5,$6,'admin',$7,$8,$9)`,
      [DEMO_TENANT_ID, serverId, body.toolName, route.tier, status, principal!.id, durationMs, errorMessage, status === 'rejected' ? errorMessage : null],
    ).catch(() => {});
  };

  if (route.tier !== 'auto') {
    await logCall('rejected', null, `Tool tier is '${route.tier}' — requires human approval, cannot execute directly through this endpoint.`);
    return Response.json({ error: `Tool tier is '${route.tier}' — requires human approval, cannot execute directly through this endpoint.` }, { status: 403 });
  }
  if (isInternalToolExecutable(body.serverSlug, body.toolName)) {
    const startedAt = Date.now();
    try {
      const result = await executeInternalTool(body.serverSlug, body.toolName, body.args ?? {});
      await logCall(result.executed ? 'success' : 'rejected', Date.now() - startedAt, result.executed ? null : (result.reason ?? null));
      return Response.json(result);
    } catch (err) {
      await logCall('failed', Date.now() - startedAt, err instanceof Error ? err.message.slice(0, 500) : 'Unknown error');
      return Response.json({ error: err instanceof Error ? err.message : 'Tool execution failed.' }, { status: 502 });
    }
  }

  if (!isExecutable(body.serverSlug, body.toolName)) {
    await logCall('rejected', null, 'This tool needs credentials not configured in this environment.');
    return Response.json({ executed: false, reason: 'This tool needs credentials not configured in this environment.' });
  }

  const startedAt = Date.now();
  try {
    const result = await executeExternalPlatformTool(body.serverSlug, body.toolName, body.args ?? {});
    await logCall('success', Date.now() - startedAt, null);
    return Response.json(result);
  } catch (err) {
    await logCall('failed', Date.now() - startedAt, err instanceof Error ? err.message.slice(0, 500) : 'Unknown error');
    return Response.json({ error: err instanceof Error ? err.message : 'Tool execution failed.' }, { status: 502 });
  }
}
