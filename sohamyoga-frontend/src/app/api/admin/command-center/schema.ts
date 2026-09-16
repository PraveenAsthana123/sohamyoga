import { query } from '@/lib/postgres';

export async function ensureSchema(): Promise<void> {
  // Create unified_content_item table
  await query(`
    CREATE TABLE IF NOT EXISTS unified_content_item (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_type TEXT NOT NULL,
      source_id UUID NOT NULL,
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      caption TEXT,
      headline TEXT,
      media_urls TEXT[] DEFAULT '{}',
      hashtags TEXT[] DEFAULT '{}',
      cta_text TEXT,
      cta_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      approval_status TEXT DEFAULT 'pending',
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      external_url TEXT,
      external_id TEXT,
      impressions BIGINT DEFAULT 0,
      reach BIGINT DEFAULT 0,
      clicks BIGINT DEFAULT 0,
      likes BIGINT DEFAULT 0,
      comments BIGINT DEFAULT 0,
      shares BIGINT DEFAULT 0,
      saves BIGINT DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      spend NUMERIC(10,2) DEFAULT 0,
      revenue NUMERIC(10,2) DEFAULT 0,
      roas NUMERIC(6,2) DEFAULT 0,
      ctr NUMERIC(5,3) DEFAULT 0,
      cpc NUMERIC(8,2) DEFAULT 0,
      engagement_rate NUMERIC(6,3) DEFAULT 0,
      failure_reason TEXT,
      last_synced_at TIMESTAMPTZ,
      created_by TEXT DEFAULT 'system',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_uci_platform ON unified_content_item(platform)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_uci_status ON unified_content_item(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_uci_scheduled ON unified_content_item(scheduled_at)`);

  // Create action log table
  await query(`
    CREATE TABLE IF NOT EXISTS unified_content_action_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID REFERENCES unified_content_item(id),
      action TEXT NOT NULL,
      actor TEXT DEFAULT 'admin',
      before_state JSONB DEFAULT '{}',
      after_state JSONB DEFAULT '{}',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed from social_post
  await query(`
    INSERT INTO unified_content_item (item_type, source_id, platform, content_type, status, scheduled_at, published_at, external_url, created_at)
    SELECT 'social_post', sp.id, sp.platform,
      COALESCE(scd.content_type, 'text_post'),
      sp.status, sp.scheduled_at, sp.published_at, sp.external_post_url, sp.created_at
    FROM social_post sp
    LEFT JOIN social_content_draft scd ON scd.id = sp.draft_id
    WHERE NOT EXISTS (SELECT 1 FROM unified_content_item uci WHERE uci.source_id = sp.id)
    ON CONFLICT DO NOTHING
  `);

  // Seed from ad_post_plan
  await query(`
    INSERT INTO unified_content_item (item_type, source_id, platform, content_type, caption, headline, cta_text, status, approval_status, scheduled_at, created_at)
    SELECT 'ad', app.id, app.platform,
      CASE app.ad_message_type
        WHEN 'video' THEN 'video_ad'
        WHEN 'carousel' THEN 'carousel'
        ELSE 'display_ad' END,
      app.body_copy, app.headline, app.cta, app.status, app.approval_status, app.scheduled_at, app.created_at
    FROM ad_post_plan app
    WHERE NOT EXISTS (SELECT 1 FROM unified_content_item uci WHERE uci.source_id = app.id)
    ON CONFLICT DO NOTHING
  `);

  // Module registry upsert
  await query(`
    INSERT INTO module_registry (app, module_key, name, description, built_status, has_admin_ui, has_user_ui,
      user_flow, admin_flow, job_name, report_location, dashboard_location, schema_tables, demo_use_cases, integration_platforms)
    VALUES (
      'sohamyoga-frontend', 'unified-command-center', 'Unified Social + Ads Command Center',
      'Single UI to create, post, monitor, track, update, delete and change every social post and ad across all platforms — YouTube, Facebook, Instagram, Twitter, LinkedIn, TikTok, Google Ads, Meta Ads.',
      'real', true, false,
      'N/A — admin-only command center.',
      'Admin opens /admin/command-center, sees all scheduled/live/published posts and ads across all platforms in one feed. Filters by platform/status/date. Clicks any item to edit caption, reschedule, pause, approve, or delete inline. Creates new posts and ads from the same UI. Monitors live metrics that auto-refresh every 60s.',
      'CommandCenterSyncJob',
      '/admin/command-center?view=grid',
      '/admin/command-center',
      ARRAY['unified_content_item','unified_content_action_log','social_post','ad_post_plan','social_post_analytics'],
      '[{"scenario":"Digital marketing manager opens Command Center Monday morning, sees 12 posts scheduled for the week across 6 platforms, pauses 2 low-performing Facebook ads, reschedules 3 Instagram posts, creates a new YouTube Short from scratch — all without leaving the page"}]'::jsonb,
      '["youtube","facebook","instagram","x_twitter","linkedin","tiktok","google_ads","meta_ads","postiz"]'::jsonb
    ) ON CONFLICT (app, module_key) DO NOTHING
  `).catch(() => {/* ignore if registry insert fails due to constraints */});
}
