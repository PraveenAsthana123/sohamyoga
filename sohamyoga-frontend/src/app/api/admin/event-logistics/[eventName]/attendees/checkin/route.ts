export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventName: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { eventName } = await params;
  const body = await req.json();
  const ids: number[] = body.ids || [];
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (ids.length > 0) {
      await client.query(
        `UPDATE event_attendees SET checked_in=true, check_in_time=NOW() WHERE id=ANY($1) AND event_name=$2`,
        [ids, decodeURIComponent(eventName)]
      );
    } else {
      // Check in all for event
      await client.query(
        `UPDATE event_attendees SET checked_in=true, check_in_time=NOW() WHERE event_name=$1 AND checked_in=false`,
        [decodeURIComponent(eventName)]
      );
    }
    const { rows } = await client.query(`SELECT COUNT(*) FILTER (WHERE checked_in) as checked, COUNT(*) as total FROM event_attendees WHERE event_name=$1`, [decodeURIComponent(eventName)]);
    return Response.json({ success: true, checked_in: rows[0].checked, total: rows[0].total });
  } finally { client.release(); }
}
