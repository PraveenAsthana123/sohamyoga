import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const before = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    if (!before.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const item = before.rows[0] as { scheduled_at: string | null };
    const newStatus = item.scheduled_at && new Date(item.scheduled_at) > new Date() ? 'scheduled' : 'live';
    const res = await query(
      `UPDATE unified_content_item SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );
    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, before_state, after_state, notes)
       VALUES ($1, 'resumed', 'admin', $2, $3, 'Resumed via Command Center')`,
      [id, JSON.stringify(before.rows[0]), JSON.stringify(res.rows[0])]
    );
    return NextResponse.json({ item: res.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
