import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ALL_MCP_SERVERS, buildGatewaySummary } from '@/domain/mcp/gateway-registry';
import { isExecutable } from '@/domain/mcp/external-platform-mcp';

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
  return Response.json({
    summary,
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
