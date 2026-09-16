import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: total unread messages across all active sessions
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT COALESCE(SUM(unread_count), 0)::int AS count
      FROM live_chat_session
      WHERE status = 'active'
    `).catch(() => ({ rows: [{ count: 0 }] }));

    return Response.json({ count: result.rows[0]?.count ?? 0 });
  } finally {
    client.release();
  }
}
