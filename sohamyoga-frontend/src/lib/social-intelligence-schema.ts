// Social Intelligence Schema — ensureSchema() creates all tables needed for
// the Social Media Platform Intelligence System. Called at the start of every
// API route so tables exist on first hit without a separate migration step.

import { query } from '@/lib/postgres';

let schemaReady = false;

export async function ensureSocialIntelligenceSchema(): Promise<void> {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS social_content_variant (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      draft_id UUID,
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      caption TEXT,
      title TEXT,
      description TEXT,
      hashtags TEXT[] DEFAULT '{}',
      mentions TEXT[] DEFAULT '{}',
      media_urls TEXT[] DEFAULT '{}',
      thumbnail_url TEXT,
      cta_text TEXT,
      cta_url TEXT,
      duration_seconds INTEGER,
      aspect_ratio TEXT,
      platform_specific JSONB DEFAULT '{}',
      char_count INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      readability_score NUMERIC(4,2),
      ai_generated BOOLEAN DEFAULT false,
      ai_model TEXT,
      ai_prompt TEXT,
      status TEXT DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_content_type_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      max_chars INTEGER,
      max_images INTEGER DEFAULT 1,
      max_video_mb INTEGER,
      max_duration_seconds INTEGER,
      supported_aspect_ratios TEXT[] DEFAULT '{}',
      required_fields TEXT[] DEFAULT '{}',
      optional_fields TEXT[] DEFAULT '{}',
      best_posting_times TEXT[] DEFAULT '{}',
      avg_engagement_rate NUMERIC(5,2) DEFAULT 0,
      tips TEXT[] DEFAULT '{}',
      enabled BOOLEAN DEFAULT true,
      UNIQUE(platform, content_type)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_platform_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      account_id UUID,
      period TEXT NOT NULL,
      content_type TEXT,
      total_posts INTEGER DEFAULT 0,
      total_impressions BIGINT DEFAULT 0,
      total_reach BIGINT DEFAULT 0,
      total_clicks BIGINT DEFAULT 0,
      total_likes BIGINT DEFAULT 0,
      total_comments BIGINT DEFAULT 0,
      total_shares BIGINT DEFAULT 0,
      total_saves BIGINT DEFAULT 0,
      total_conversions INTEGER DEFAULT 0,
      follower_count BIGINT DEFAULT 0,
      follower_delta INTEGER DEFAULT 0,
      avg_engagement_rate NUMERIC(6,3) DEFAULT 0,
      yt_watch_time_hours NUMERIC(10,2) DEFAULT 0,
      yt_avg_view_duration INTEGER DEFAULT 0,
      yt_ctr NUMERIC(5,2) DEFAULT 0,
      yt_revenue NUMERIC(10,2) DEFAULT 0,
      yt_subscribers_gained INTEGER DEFAULT 0,
      tt_play_count BIGINT DEFAULT 0,
      tt_completion_rate NUMERIC(5,2) DEFAULT 0,
      tt_profile_visits INTEGER DEFAULT 0,
      ig_story_views BIGINT DEFAULT 0,
      ig_reel_plays BIGINT DEFAULT 0,
      ig_profile_visits INTEGER DEFAULT 0,
      li_article_views BIGINT DEFAULT 0,
      li_connection_requests INTEGER DEFAULT 0,
      li_company_page_views INTEGER DEFAULT 0,
      tw_retweets BIGINT DEFAULT 0,
      tw_quote_tweets BIGINT DEFAULT 0,
      tw_link_clicks BIGINT DEFAULT 0,
      tw_profile_visits INTEGER DEFAULT 0,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_hashtag_performance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      hashtag TEXT NOT NULL,
      niche TEXT,
      avg_reach BIGINT DEFAULT 0,
      avg_engagement NUMERIC(6,3) DEFAULT 0,
      post_count_this_week INTEGER DEFAULT 0,
      trending_score NUMERIC(5,2) DEFAULT 0,
      competition_level TEXT DEFAULT 'medium',
      recommended_for TEXT[] DEFAULT '{}',
      last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, hashtag)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_calendar_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_id UUID,
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      title TEXT,
      caption_preview TEXT,
      color_tag TEXT DEFAULT '#3B82F6',
      scheduled_at TIMESTAMPTZ NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      status TEXT DEFAULT 'scheduled',
      repeat_rule TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_alert_rule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT,
      alert_type TEXT NOT NULL,
      metric TEXT,
      threshold_value NUMERIC,
      comparison TEXT,
      window_minutes INTEGER DEFAULT 60,
      severity TEXT DEFAULT 'medium',
      notification_channels TEXT[] DEFAULT '{email}',
      is_active BOOLEAN DEFAULT true,
      last_triggered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_alert_event (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES social_alert_rule(id),
      platform TEXT,
      alert_type TEXT NOT NULL,
      severity TEXT,
      message TEXT,
      metric_value NUMERIC,
      triggered_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_test_scenario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      scenario_name TEXT NOT NULL,
      polarity TEXT NOT NULL,
      test_level TEXT NOT NULL,
      precondition TEXT,
      steps JSONB DEFAULT '[]',
      expected_result TEXT,
      api_endpoint TEXT,
      http_method TEXT,
      test_payload JSONB DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      last_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(scenario_name, platform, content_type)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS social_tenant_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      posting_frequency TEXT,
      primary_content_types TEXT[] DEFAULT '{}',
      tone TEXT,
      top_hashtags TEXT[] DEFAULT '{}',
      best_times TEXT[] DEFAULT '{}',
      kpi_focus TEXT,
      notes TEXT,
      UNIQUE(tenant_type, platform)
    )
  `);

  schemaReady = true;
}
