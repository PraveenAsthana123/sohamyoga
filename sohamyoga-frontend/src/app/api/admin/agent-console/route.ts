import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_AGENT_STATUSES = ['online', 'busy', 'away', 'offline'];
const VALID_BOT_STATUSES = ['active', 'inactive', 'maintenance'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [agents, conversations, bots, summary] = await Promise.all([
    query<{
      id: string; user_id: string; display_name: string; role: string; status: string;
      max_concurrent_chats: number; skill_tags: string[]; avg_response_time_secs: number | null;
      satisfaction_score: number | null; shift_start: string | null; shift_end: string | null;
      created_at: string;
    }>(
      `SELECT id, user_id, display_name, role, status, max_concurrent_chats,
              skill_tags, avg_response_time_secs, satisfaction_score,
              shift_start::text, shift_end::text, created_at
       FROM chat_agent
       ORDER BY status, display_name`,
    ),
    query<{
      id: string; customer_id: string; channel: string; status: string; priority: string;
      subject: string | null; message_count: number; last_activity_at: string; opened_at: string;
      assigned_agent_id: string | null; assigned_bot_id: string | null;
    }>(
      `SELECT id, customer_id, channel, status, priority, subject,
              message_count, last_activity_at, opened_at,
              assigned_agent_id, assigned_bot_id
       FROM chat_conversation
       ORDER BY last_activity_at DESC LIMIT 50`,
    ),
    query<{
      id: string; name: string; bot_type: string; status: string; model: string | null;
      max_turns: number; temperature: string; confidence_threshold: string;
      response_timeout_ms: number; created_at: string; updated_at: string;
    }>(
      `SELECT id, name, bot_type, status, model, max_turns,
              temperature::text, confidence_threshold::text,
              response_timeout_ms, created_at, updated_at
       FROM chat_bot
       ORDER BY status DESC, name`,
    ),
    query<{
      active_agents: string; total_conversations: string; open_conversations: string; bots_configured: string;
    }>(
      `SELECT
         count(*) FILTER (WHERE status = 'online')::text AS active_agents,
         (SELECT count(*)::text FROM chat_conversation) AS total_conversations,
         (SELECT count(*)::text FROM chat_conversation WHERE status IN ('pending','open','snoozed')) AS open_conversations,
         (SELECT count(*)::text FROM chat_bot WHERE status = 'active') AS bots_configured
       FROM chat_agent`,
    ),
  ]);

  const s = summary.rows[0];
  return Response.json({
    agents: agents.rows,
    conversations: conversations.rows,
    bots: bots.rows,
    summary: {
      activeAgents: Number(s?.active_agents ?? 0),
      totalConversations: Number(s?.total_conversations ?? 0),
      openConversations: Number(s?.open_conversations ?? 0),
      botsConfigured: Number(s?.bots_configured ?? 0),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    type?: 'agent' | 'bot'; id?: string; status?: string;
  } | null;

  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (!body.type || !['agent', 'bot'].includes(body.type)) {
    return Response.json({ error: 'type must be "agent" or "bot".' }, { status: 400 });
  }

  if (body.type === 'agent') {
    if (!body.status || !VALID_AGENT_STATUSES.includes(body.status)) {
      return Response.json({ error: `agent status must be one of: ${VALID_AGENT_STATUSES.join(', ')}` }, { status: 400 });
    }
    const result = await query(
      `UPDATE chat_agent SET status = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, display_name, status, updated_at`,
      [body.id, body.status],
    );
    if (!result.rowCount) return Response.json({ error: 'Agent not found.' }, { status: 404 });
    return Response.json({ agent: result.rows[0] });
  }

  // bot
  if (!body.status || !VALID_BOT_STATUSES.includes(body.status)) {
    return Response.json({ error: `bot status must be one of: ${VALID_BOT_STATUSES.join(', ')}` }, { status: 400 });
  }
  const result = await query(
    `UPDATE chat_bot SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, name, status, updated_at`,
    [body.id, body.status],
  );
  if (!result.rowCount) return Response.json({ error: 'Bot not found.' }, { status: 404 });
  return Response.json({ bot: result.rows[0] });
}
