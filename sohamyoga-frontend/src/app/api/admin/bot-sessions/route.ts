export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const sessions = await client.query(`
      SELECT cc.id, cc.customer_id, cc.channel, cc.status, cc.priority,
        cc.subject, cc.assigned_bot_id, cc.message_count, cc.last_activity_at,
        cc.opened_at, cc.resolved_at,
        cb.name as bot_name
      FROM chat_conversation cc
      LEFT JOIN chat_bot cb ON cb.id = cc.assigned_bot_id
      WHERE cc.assigned_bot_id IS NOT NULL
      ORDER BY cc.last_activity_at DESC NULLS LAST
      LIMIT 100
    `).catch(() => ({ rows: [] }));

    const summary = {
      total: sessions.rows.length,
      active: (sessions.rows as Array<{ status: string }>).filter(s => s.status === 'open').length,
      resolved: (sessions.rows as Array<{ status: string }>).filter(s => s.status === 'resolved').length,
    };

    return Response.json({ sessions: sessions.rows, summary });
  } finally {
    client.release();
  }
}
