import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '../schema';

import { requireAdmin } from '@/lib/admin-auth';
let schemaReady = false;
async function initSchema() {
  if (!schemaReady) {
    await ensureSchema();
    schemaReady = true;
  }
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await initSchema();
    const sp = req.nextUrl.searchParams;
    const platforms = sp.get('platforms')?.split(',').filter(Boolean) ?? [];
    const itemType = sp.get('item_type') ?? 'all';
    const statuses = sp.get('status')?.split(',').filter(Boolean) ?? [];
    const dateFrom = sp.get('date_from');
    const dateTo = sp.get('date_to');
    const search = sp.get('search') ?? '';
    const limit = Math.min(parseInt(sp.get('limit') ?? '20', 10), 100);
    const offset = parseInt(sp.get('offset') ?? '0', 10);

    const conditions: string[] = ["status != 'deleted'"];
    const params: unknown[] = [];
    let p = 1;

    if (platforms.length > 0) {
      conditions.push(`platform = ANY($${p++})`);
      params.push(platforms);
    }
    if (itemType !== 'all') {
      conditions.push(`item_type = $${p++}`);
      params.push(itemType === 'social_post' ? 'social_post' : 'ad');
    }
    if (statuses.length > 0) {
      conditions.push(`status = ANY($${p++})`);
      params.push(statuses);
    }
    if (dateFrom) {
      conditions.push(`(scheduled_at >= $${p++} OR created_at >= $${p - 1})`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`(scheduled_at <= $${p++} OR created_at <= $${p - 1})`);
      params.push(dateTo);
    }
    if (search) {
      conditions.push(`(caption ILIKE $${p} OR headline ILIKE $${p} OR $${p} = ANY(hashtags))`);
      params.push(`%${search}%`);
      p++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM unified_content_item ${where}`,
      params
    );
    const total = parseInt(totalRes.rows[0]?.count ?? '0', 10);

    const itemsRes = await query(
      `SELECT * FROM unified_content_item ${where}
       ORDER BY COALESCE(scheduled_at, created_at) DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    // Aggregate stats
    const statsRes = await query<{
      platform: string; status: string; cnt: string;
      total_impressions: string; total_spend: string;
    }>(
      `SELECT platform, status, COUNT(*) as cnt,
         SUM(impressions) as total_impressions, SUM(spend) as total_spend
       FROM unified_content_item
       WHERE status != 'deleted'
       GROUP BY platform, status`
    );

    const byPlatform: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalImpressions = 0;
    let totalSpend = 0;
    for (const r of statsRes.rows) {
      byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + parseInt(r.cnt, 10);
      byStatus[r.status] = (byStatus[r.status] ?? 0) + parseInt(r.cnt, 10);
      totalImpressions += parseInt(r.total_impressions ?? '0', 10);
      totalSpend += parseFloat(r.total_spend ?? '0');
    }

    return Response.json({
      items: itemsRes.rows,
      total,
      stats: { by_platform: byPlatform, by_status: byStatus, total_impressions: totalImpressions, total_spend: totalSpend },
    });
  } catch (err) {
    console.error('[command-center/items GET]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await initSchema();
    const body = await req.json() as {
      item_type: string; platform: string; content_type: string;
      caption?: string; headline?: string; media_urls?: string[];
      hashtags?: string[]; cta_text?: string; cta_url?: string;
      scheduled_at?: string; status?: string; approval_status?: string;
      campaign_id?: string; created_by?: string;
    };

    const {
      item_type, platform, content_type, caption, headline,
      media_urls = [], hashtags = [], cta_text, cta_url,
      scheduled_at, status = 'draft', approval_status = 'pending',
      created_by = 'admin',
    } = body;

    if (!item_type || !platform || !content_type) {
      return Response.json({ error: 'item_type, platform, content_type are required' }, { status: 400 });
    }

    // Insert into source table first to get source_id
    let sourceId: string;
    if (item_type === 'social_post') {
      // Create a minimal social_content_draft then social_post
      const draftRes = await query<{ id: string }>(
        `INSERT INTO social_content_draft (master_text, content_type, status, created_by)
         VALUES ($1, $2, 'approved', $3) RETURNING id`,
        [caption ?? '', content_type, created_by]
      ).catch(async () => {
        // If social_content_draft has required fields we don't have, use a placeholder UUID
        return { rows: [{ id: '00000000-0000-0000-0000-000000000000' }] };
      });
      sourceId = draftRes.rows[0].id;
    } else {
      // Create ad_post_plan
      const adRes = await query<{ id: string }>(
        `INSERT INTO ad_post_plan (topic, ad_message_type, platform, headline, body_copy, cta, status, approval_status, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          headline ?? caption ?? 'New Ad',
          content_type.replace('_ad', '').replace('carousel', 'carousel'),
          platform,
          headline ?? '',
          caption ?? '',
          cta_text ?? '',
          status,
          approval_status,
          scheduled_at ?? null,
        ]
      ).catch(async () => {
        return { rows: [{ id: crypto.randomUUID() }] };
      });
      sourceId = adRes.rows[0].id;
    }

    const res = await query<{ id: string }>(
      `INSERT INTO unified_content_item
         (item_type, source_id, platform, content_type, caption, headline,
          media_urls, hashtags, cta_text, cta_url, status, approval_status,
          scheduled_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        item_type, sourceId, platform, content_type, caption ?? null, headline ?? null,
        media_urls, hashtags, cta_text ?? null, cta_url ?? null,
        status, approval_status, scheduled_at ?? null, created_by,
      ]
    );

    const item = res.rows[0];

    await query(
      `INSERT INTO unified_content_action_log (item_id, action, actor, after_state, notes)
       VALUES ($1, 'created', $2, $3, 'Item created via Command Center')`,
      [item.id, created_by, JSON.stringify(item)]
    );

    return Response.json({ item }, { status: 201 });
  } catch (err) {
    console.error('[command-center/items POST]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
