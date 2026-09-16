import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize tables on first load
async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS ad_post_plan (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid REFERENCES ad_campaign(id) ON DELETE CASCADE,
      ad_id uuid REFERENCES advertisement(id) ON DELETE SET NULL,
      topic text NOT NULL,
      ad_message_type text NOT NULL,
      platform text NOT NULL,
      headline text NOT NULL,
      body_copy text NOT NULL,
      cta text NOT NULL,
      visual_url text,
      visual_type text DEFAULT 'image',
      emoji_set text[],
      hashtags text[],
      scheduled_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      approval_status text NOT NULL DEFAULT 'pending',
      approved_by text,
      approved_at timestamptz,
      rejection_reason text,
      created_by text NOT NULL DEFAULT 'admin',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ad_engagement (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id uuid REFERENCES ad_post_plan(id) ON DELETE CASCADE,
      customer_id uuid,
      session_id text,
      event_type text NOT NULL,
      emoji_reaction text,
      platform text NOT NULL,
      device_type text,
      country text,
      city text,
      referrer text,
      funnel_stage text,
      time_on_ad_seconds integer,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ad_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id uuid REFERENCES ad_post_plan(id) ON DELETE CASCADE,
      customer_id uuid,
      customer_name text,
      customer_email text,
      rating integer CHECK (rating BETWEEN 1 AND 5),
      comment text,
      sentiment text,
      source text NOT NULL DEFAULT 'organic',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ad_visual_asset (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      url text NOT NULL,
      asset_type text NOT NULL DEFAULT 'image',
      ad_message_type text,
      platform text[],
      width_px integer,
      height_px integer,
      file_size_kb integer,
      tags text[],
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');
  const campaign_id = searchParams.get('campaign_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`p.status = $${idx++}`); values.push(status); }
  if (platform) { conditions.push(`p.platform = $${idx++}`); values.push(platform); }
  if (campaign_id) { conditions.push(`p.campaign_id = $${idx++}`); values.push(campaign_id); }
  if (from) { conditions.push(`p.scheduled_at >= $${idx++}`); values.push(from); }
  if (to) { conditions.push(`p.scheduled_at <= $${idx++}`); values.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(`
    SELECT p.*, c.name as campaign_name
    FROM ad_post_plan p
    LEFT JOIN ad_campaign c ON c.id = p.campaign_id
    ${where}
    ORDER BY p.scheduled_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, [...values, limit, offset]);

  const countResult = await query(`SELECT COUNT(*) FROM ad_post_plan p ${where}`, values);

  return Response.json({ plans: result.rows, total: parseInt(countResult.rows[0].count) });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const body = await req.json();
  const {
    campaign_id, ad_id, topic, ad_message_type, platform, headline, body_copy, cta,
    visual_url, visual_type, emoji_set, hashtags, scheduled_at, status, approval_status, created_by
  } = body;

  if (!topic || !ad_message_type || !platform || !headline || !body_copy || !cta || !scheduled_at) {
    return Response.json({ error: 'topic, ad_message_type, platform, headline, body_copy, cta, scheduled_at are required' }, { status: 400 });
  }

  const result = await query<{ id: string }>(`
    INSERT INTO ad_post_plan
      (campaign_id, ad_id, topic, ad_message_type, platform, headline, body_copy, cta,
       visual_url, visual_type, emoji_set, hashtags, scheduled_at, status, approval_status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING id
  `, [
    campaign_id || null, ad_id || null, topic, ad_message_type, platform, headline, body_copy, cta,
    visual_url || null, visual_type || 'image', emoji_set || [], hashtags || [],
    scheduled_at, status || 'draft', approval_status || 'pending', created_by || 'admin'
  ]);

  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
