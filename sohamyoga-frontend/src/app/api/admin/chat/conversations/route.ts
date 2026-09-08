import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; customer_id: string; channel: string; status: string; priority: string; subject: string | null;
    agent_name: string | null; bot_name: string | null; message_count: number; last_activity_at: string;
    last_message: string | null;
  }>(
    `SELECT c.id, c.customer_id, c.channel::text, c.status::text, c.priority::text, c.subject,
            a.display_name AS agent_name, b.name AS bot_name, c.message_count, c.last_activity_at,
            (SELECT content FROM chat_message m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
     FROM chat_conversation c
     LEFT JOIN chat_agent a ON a.id = c.assigned_agent_id
     LEFT JOIN chat_bot b ON b.id = c.assigned_bot_id
     ORDER BY c.last_activity_at DESC LIMIT 100`,
  );

  return Response.json({
    conversations: rows.rows.map((r) => ({
      id: r.id, customerId: r.customer_id, channel: r.channel, status: r.status, priority: r.priority,
      subject: r.subject, agent: r.agent_name ?? r.bot_name ?? null, messageCount: r.message_count,
      lastActivityAt: r.last_activity_at, lastMessage: r.last_message,
    })),
  });
}
