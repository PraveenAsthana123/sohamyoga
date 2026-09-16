import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const src = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    if (!src.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const s = src.rows[0] as Record<string, unknown>;
    const res = await query(
      `INSERT INTO unified_content_item
         (item_type, source_id, platform, content_type, caption, headline,
          media_urls, hashtags, cta_text, cta_url, status, approval_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft','pending',$11)
       RETURNING *`,
      [
        s.item_type, s.source_id, s.platform, s.content_type,
        s.caption, s.headline, s.media_urls, s.hashtags,
        s.cta_text, s.cta_url, s.created_by ?? 'admin',
      ]
    );
    const newItem = res.rows[0];
    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, notes)
       VALUES ($1, 'duplicated', 'admin', $2)`,
      [newItem.id, `Duplicated from ${id}`]
    );
    return Response.json({ item: newItem }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
