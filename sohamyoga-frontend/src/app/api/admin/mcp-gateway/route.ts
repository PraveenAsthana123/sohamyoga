import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ALL_MCP_SERVERS, buildGatewaySummary } from '@/domain/mcp/gateway-registry';
import { isExecutable } from '@/domain/mcp/external-platform-mcp';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real MCP gateway catalog — this registry (15 internal domain servers +
 * 14 external-platform servers) existed as pure TypeScript domain code
 * with a real Postgres schema behind it, but had zero API route or admin
 * page anywhere in the app until now — the same "rich schema, nothing
 * built on top" pattern found repeatedly elsewhere this session.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const summary = buildGatewaySummary();

  // Real report data from mcp_tool_call -- empty until a tool is actually
  // executed via /api/admin/mcp-gateway/execute, which now logs every call
  // (previously logged nothing at all).
  const recentCalls = databaseConfigured()
    ? await query(
        `SELECT tc.tool_name, tc.tier, tc.status, tc.duration_ms, tc.error_message, tc.created_at, ms.name AS server_name
         FROM mcp_tool_call tc JOIN mcp_server ms ON ms.id = tc.server_id
         ORDER BY tc.created_at DESC LIMIT 50`,
      ).catch(() => ({ rows: [] }))
    : { rows: [] };
  const callStats = databaseConfigured()
    ? await query<{ status: string; count: string }>(`SELECT status, count(*)::text AS count FROM mcp_tool_call GROUP BY status`).catch(() => ({ rows: [] }))
    : { rows: [] };

  return Response.json({
    summary,
    recentCalls: recentCalls.rows,
    callStats: Object.fromEntries((callStats.rows as { status: string; count: string }[]).map(r => [r.status, Number(r.count)])),
    servers: ALL_MCP_SERVERS.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      availability: s.availability,
      backingServices: s.backingServices,
      implementationNote: s.implementationNote,
      tools: s.tools.map(t => ({
        name: t.name,
        description: t.description,
        tier: t.tier,
        riskLevel: t.riskLevel,
        safetyNote: t.safetyNote,
        tags: t.tags,
        executable: isExecutable(s.slug, t.name),
      })),
    })),
  });
}
