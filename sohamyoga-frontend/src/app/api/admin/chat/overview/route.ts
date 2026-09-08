import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Omnichannel Communication Inbox -- this page previously rendered a
// hardcoded "// Mock data" block (fake conversations, fake agents, fake
// KPI numbers) even though the real schema (chat_conversation, chat_agent,
// chat_bot, chat_message) already existed with zero rows. Replaced with
// real queries throughout -- an honest empty state until real chat traffic
// exists, never a fabricated number.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [statusCounts, unassigned, agents, bots] = await Promise.all([
    query<{ status: string; n: string }>(`SELECT status::text, count(*)::text AS n FROM chat_conversation GROUP BY status`),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM chat_conversation WHERE assigned_agent_id IS NULL AND status <> 'resolved'`),
    query<{ status: string; n: string }>(`SELECT status::text, count(*)::text AS n FROM chat_agent GROUP BY status`),
    query<{ status: string; n: string }>(`SELECT status::text, count(*)::text AS n FROM chat_bot GROUP BY status`),
  ]);

  const byStatus = Object.fromEntries(statusCounts.rows.map((r) => [r.status, Number(r.n)]));
  const agentsByStatus = Object.fromEntries(agents.rows.map((r) => [r.status, Number(r.n)]));
  const botsByStatus = Object.fromEntries(bots.rows.map((r) => [r.status, Number(r.n)]));

  return Response.json({
    openConversations: byStatus.open ?? 0,
    pendingUnassigned: Number(unassigned.rows[0]?.n ?? 0),
    resolvedConversations: byStatus.resolved ?? 0,
    snoozedConversations: byStatus.snoozed ?? 0,
    agentsOnline: agentsByStatus.online ?? 0,
    totalAgents: agents.rows.reduce((s, r) => s + Number(r.n), 0),
    botsActive: botsByStatus.active ?? 0,
    totalBots: bots.rows.reduce((s, r) => s + Number(r.n), 0),
  });
}
