import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const plan_id = searchParams.get('plan_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') || '50');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (plan_id) { conditions.push(`e.plan_id = $${idx++}`); values.push(plan_id); }
  if (from) { conditions.push(`e.created_at >= $${idx++}`); values.push(from); }
  if (to) { conditions.push(`e.created_at <= $${idx++}`); values.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(`
    SELECT e.*, p.headline, p.platform as plan_platform
    FROM ad_engagement e
    LEFT JOIN ad_post_plan p ON p.id = e.plan_id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT $${idx}
  `, [...values, limit]);

  // Reaction totals
  const reactions = await query(`
    SELECT emoji_reaction, COUNT(*) as count
    FROM ad_engagement
    WHERE event_type = 'like' AND emoji_reaction IS NOT NULL
    GROUP BY emoji_reaction
  `);

  // Funnel stage counts
  const funnel = await query(`
    SELECT funnel_stage, COUNT(*) as count
    FROM ad_engagement
    WHERE funnel_stage IS NOT NULL
    GROUP BY funnel_stage
  `);

  // Geographic top 5
  const geo = await query(`
    SELECT city, country, COUNT(*) as count
    FROM ad_engagement
    WHERE city IS NOT NULL
    GROUP BY city, country
    ORDER BY count DESC
    LIMIT 5
  `);

  // Device split
  const devices = await query(`
    SELECT device_type, COUNT(*) as count
    FROM ad_engagement
    WHERE device_type IS NOT NULL
    GROUP BY device_type
  `);

  return Response.json({
    events: result.rows,
    reactions: reactions.rows,
    funnel: funnel.rows,
    geo: geo.rows,
    devices: devices.rows
  });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { plan_id, customer_id, session_id, event_type, emoji_reaction, platform, device_type, country, city, referrer, funnel_stage, time_on_ad_seconds } = body;

  if (!event_type || !platform) {
    return Response.json({ error: 'event_type and platform required' }, { status: 400 });
  }

  const result = await query<{ id: string }>(`
    INSERT INTO ad_engagement (plan_id, customer_id, session_id, event_type, emoji_reaction, platform, device_type, country, city, referrer, funnel_stage, time_on_ad_seconds)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id
  `, [plan_id || null, customer_id || null, session_id || null, event_type, emoji_reaction || null, platform, device_type || null, country || null, city || null, referrer || null, funnel_stage || null, time_on_ad_seconds || null]);

  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
