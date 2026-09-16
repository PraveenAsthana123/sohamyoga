import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = body.reason ?? 'Rejected';
    const res = await query(
      `UPDATE unified_content_item
       SET approval_status = 'rejected', failure_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, after_state, notes)
       VALUES ($1, 'rejected', 'admin', $2, $3)`,
      [id, JSON.stringify(res.rows[0]), `Rejected: ${reason}`]
    );
    return NextResponse.json({ item: res.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
