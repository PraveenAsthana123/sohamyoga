import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';

  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: string[] = [];
    if (status && status !== 'all') {
      conditions.push(`cc.status::text = $1`);
      values.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [conversations, handoffs, kpi] = await Promise.all([
      client.query(
        `SELECT cc.id, cc.customer_id, cc.channel::text AS channel, cc.status::text AS status,
                cc.priority::text AS priority, cc.subject,
                cc.message_count, cc.last_activity_at, cc.opened_at, cc.resolved_at,
                ca.name AS agent_name
         FROM chat_conversation cc
         LEFT JOIN chat_agent ca ON ca.id = cc.assigned_agent_id
         ${where}
         ORDER BY cc.last_activity_at DESC LIMIT 200`,
        values,
      ),
      client.query(
        `SELECT ch.id, ch.conversation_id, ch.reason, ch.confidence, ch.created_at,
                ca.name AS agent_name
         FROM chat_handoff ch
         LEFT JOIN chat_agent ca ON ca.id = ch.to_agent_id
         ORDER BY ch.created_at DESC LIMIT 100`,
      ),
      client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status::text IN ('open','pending'))::int AS live,
           COUNT(*) FILTER (WHERE status::text = 'pending')::int AS waiting,
           COUNT(*) FILTER (WHERE status::text = 'resolved' AND resolved_at >= CURRENT_DATE)::int AS resolved_today,
           (SELECT COUNT(*)::int FROM chat_handoff WHERE created_at >= CURRENT_DATE) AS handoffs_today
         FROM chat_conversation`,
      ),
    ]);

    return Response.json({
      conversations: conversations.rows,
      handoffs: handoffs.rows,
      kpi: kpi.rows[0],
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) {
    return Response.json({ error: 'id and status are required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE chat_conversation
       SET status = $2::conversation_status,
           resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [body.id, body.status],
    );
    if (!result.rowCount) return Response.json({ error: 'Conversation not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
