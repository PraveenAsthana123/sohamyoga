import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const res = await query(
      `UPDATE unified_content_item SET approval_status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!res.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, after_state, notes)
       VALUES ($1, 'approved', 'admin', $2, 'Approved via Command Center')`,
      [id, JSON.stringify(res.rows[0])]
    );
    return Response.json({ item: res.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
