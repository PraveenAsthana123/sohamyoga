import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const res = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    if (!res.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const logs = await query(
      `SELECT * FROM unified_content_action_log WHERE item_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );
    return Response.json({ item: res.rows[0], action_log: logs.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json() as Record<string, unknown>;
    const { actor = 'admin', ...fields } = body;

    // Get before state
    const before = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    if (!before.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const allowedFields = [
      'caption', 'headline', 'media_urls', 'hashtags', 'cta_text', 'cta_url',
      'status', 'approval_status', 'scheduled_at', 'published_at',
      'external_url', 'external_id', 'failure_reason',
      'impressions', 'reach', 'clicks', 'likes', 'comments', 'shares',
      'saves', 'conversions', 'spend', 'revenue', 'roas', 'ctr', 'cpc',
      'engagement_rate', 'last_synced_at',
    ];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowedFields.includes(k)) {
        sets.push(`${k} = $${p++}`);
        vals.push(v);
      }
    }
    if (sets.length === 0) return Response.json({ error: 'No valid fields' }, { status: 400 });

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    const res = await query(
      `UPDATE unified_content_item SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      vals
    );

    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, before_state, after_state, notes)
       VALUES ($1, 'updated', $2, $3, $4, $5)`,
      [id, actor, JSON.stringify(before.rows[0]), JSON.stringify(res.rows[0]), `Fields: ${Object.keys(fields).join(', ')}`]
    );

    // Propagate to source table if status changed
    if (fields.status) {
      const item = res.rows[0];
      if (item.item_type === 'social_post') {
        await query(`UPDATE social_post SET status = $1 WHERE id = $2`, [fields.status, item.source_id]).catch(() => {});
      } else if (item.item_type === 'ad') {
        await query(`UPDATE ad_post_plan SET status = $1 WHERE id = $2`, [fields.status, item.source_id]).catch(() => {});
      }
    }

    return Response.json({ item: res.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const before = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    if (!before.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    await query(
      `UPDATE unified_content_item SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, before_state, notes)
       VALUES ($1, 'deleted', 'admin', $2, 'Soft-deleted via Command Center')`,
      [id, JSON.stringify(before.rows[0])]
    );

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
