import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [agents, load] = await Promise.all([
    query<{ id: string; display_name: string; role: string; status: string; max_concurrent_chats: number; satisfaction_score: number | null }>(
      `SELECT id, display_name, role::text, status::text, max_concurrent_chats, satisfaction_score FROM chat_agent ORDER BY display_name`,
    ),
    query<{ assigned_agent_id: string; n: string }>(
      `SELECT assigned_agent_id, count(*)::text AS n FROM chat_conversation WHERE assigned_agent_id IS NOT NULL AND status <> 'resolved' GROUP BY assigned_agent_id`,
    ),
  ]);
  const loadMap = new Map(load.rows.map((r) => [r.assigned_agent_id, Number(r.n)]));

  return Response.json({
    agents: agents.rows.map((a) => ({
      id: a.id, name: a.display_name, role: a.role, status: a.status,
      currentLoad: loadMap.get(a.id) ?? 0, maxConcurrent: a.max_concurrent_chats,
      csat: a.satisfaction_score,
    })),
  });
}
