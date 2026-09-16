// GET /api/admin/social/platform-data?platform=youtube&tab=videos
// Returns platform + tab specific data from unified_content_item,
// social_platform_analytics, or reputation_review depending on tab type.
// Also creates the required tables if they don't exist yet (ensureSchema pattern).

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

// Create tables if missing (idempotent)
async function ensurePlatformDataSchema(): Promise<void> {
  // unified_content_item — cross-platform content store
  await query(`
    CREATE TABLE IF NOT EXISTS unified_content_item (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      title TEXT,
      body TEXT,
      url TEXT,
      status TEXT DEFAULT 'draft',
      impressions BIGINT DEFAULT 0,
      reach BIGINT DEFAULT 0,
      clicks BIGINT DEFAULT 0,
      likes BIGINT DEFAULT 0,
      comments BIGINT DEFAULT 0,
      shares BIGINT DEFAULT 0,
      saves BIGINT DEFAULT 0,
      plays BIGINT DEFAULT 0,
      watch_time_seconds BIGINT DEFAULT 0,
      external_id TEXT,
      metadata JSONB DEFAULT '{}',
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_uci_platform_type ON unified_content_item(platform, content_type)`);

  // social_platform_analytics — KPI snapshots per platform
  await query(`
    CREATE TABLE IF NOT EXISTS social_platform_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      metric_value NUMERIC DEFAULT 0,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_spa_platform ON social_platform_analytics(platform, metric_key)`);

  // reputation_review — reviews from Google Business, Trustpilot, Yelp, TripAdvisor, etc.
  await query(`
    CREATE TABLE IF NOT EXISTS reputation_review (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      reviewer_name TEXT,
      rating NUMERIC(3,1),
      title TEXT,
      body TEXT,
      status TEXT DEFAULT 'pending',
      responded_at TIMESTAMPTZ,
      external_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_rr_platform ON reputation_review(platform)`);
}

// Tabs that pull from reputation_review
const REVIEW_TABS = new Set(['reviews', 'responses', 'flagged', 'invitations']);

// Tabs that aggregate KPIs from social_platform_analytics
const ANALYTICS_TABS = new Set(['analytics']);

// Map a tab id to a list of content_type values in unified_content_item
function tabToContentTypes(tab: string): string[] {
  const MAP: Record<string, string[]> = {
    videos: ['video'], shorts: ['short'], live: ['live'], playlists: ['playlist'],
    community: ['community_post'], comments: ['comment'], chapters: ['chapter'],
    posts: ['post', 'text_post'], stories: ['story'], reels: ['reel'],
    feed: ['feed_post', 'post'], carousel: ['carousel'], shopping: ['shopping_post'],
    hashtags: ['hashtag'], collab: ['collab_post'], tweets: ['tweet'], threads: ['thread'],
    spaces: ['space'], polls: ['poll'], lists: ['list'], trending: ['trending'],
    dm: ['dm'], articles: ['article'], documents: ['document'], events: ['event'],
    newsletter: ['newsletter'], company: ['company_update'], 'lead-gen': ['lead_form'],
    sounds: ['sound'], trends: ['trend'], duets: ['duet'], effects: ['effect'],
    messages: ['message'], templates: ['template'], broadcasts: ['broadcast'],
    contacts: ['contact'], chatbot: ['chatbot_log'], catalog: ['catalog_item'],
    compliance: ['compliance_log'], pins: ['pin'], boards: ['board'],
    'idea-pins': ['idea_pin'], 'rich-pins': ['rich_pin'], 'promoted-pins': ['promoted_pin'],
    subreddits: ['subreddit'], communities: ['community'], awards: ['award'], flair: ['flair'],
    spotlight: ['spotlight'], lenses: ['lens'], filters: ['filter'], map: ['snap_map'],
    score: ['score'], channels: ['channel'], bots: ['bot_log'], members: ['member'],
    forums: ['forum_thread'], stage: ['stage_event'], streams: ['stream'],
    clips: ['clip'], schedule: ['schedule_entry'], subscribers: ['subscriber'],
    'channel-points': ['channel_point_redemption'], drops: ['drop'], raids: ['raid'],
    series: ['series'], publications: ['publication'], drafts: ['draft'],
    earnings: ['earning'], seo: ['seo_snapshot'], podcasts: ['podcast'],
    revenue: ['revenue_snapshot'], referrals: ['referral'], repos: ['repo'],
    releases: ['release'], discussions: ['discussion'], gists: ['gist'],
    sponsors: ['sponsor'], actions: ['ci_run'], pages: ['page'],
    snippets: ['snippet'], wiki: ['wiki_page'], 'merge-requests': ['merge_request'],
    packages: ['package'], registry: ['registry_image'], photos: ['photo'],
    products: ['product'], 'q-and-a': ['qa_post'], locations: ['location'],
    messaging: ['message'], categories: ['category'], flagged: ['flagged'],
    integrations: ['integration'], widgets: ['widget'], showcases: ['showcase'],
    privacy: ['privacy_setting'], embed: ['embed_config'], review: ['review_request'],
    tracks: ['track'], reposts: ['repost'], 'next-pro': ['pro_stat'],
    followers: ['follower_snapshot'], episodes: ['episode'], shows: ['show'],
    audience: ['audience_snapshot'], distribution: ['distribution_channel'],
    transcripts: ['transcript'], subscriptions: ['subscription'],
    patrons: ['patron'], tiers: ['tier'], benefits: ['benefit'],
    toots: ['toot'], local: ['local_post'], federated: ['federated_post'],
    bookmarks: ['bookmark'], instances: ['instance_snapshot'],
    feeds: ['feed'], 'starter-packs': ['starter_pack'], labelers: ['labeler'],
    following: ['follow_snapshot'], replies: ['reply'], mentions: ['mention'],
    insights: ['insight'], search: ['search_result'], reblogs: ['reblog'],
    tags: ['tag'], queue: ['queue_entry'], blogs: ['blog'], asks: ['ask'],
    'check-ins': ['check_in'], competitors: ['competitor'], ranking: ['ranking_snapshot'],
    experiences: ['experience'], answers: ['answer'], questions: ['question'],
    spaces_quora: ['space'], profile: ['profile_snapshot'], digest: ['digest'],
    reputation: ['reputation_snapshot'], teams: ['team'], jobs: ['job'],
    collectives: ['collective'], playlists_dm: ['playlist'], monetization: ['monetization_snapshot'],
    channel: ['channel_config'], subtitles: ['subtitle'],
  };
  return MAP[tab] ?? [tab];
}

let schemaEnsured = false;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const platform = searchParams.get('platform') ?? '';
  const tab = searchParams.get('tab') ?? '';

  if (!platform || !tab) {
    return NextResponse.json({ error: 'platform and tab query params are required' }, { status: 400 });
  }

  try {
    if (!schemaEnsured) {
      await ensurePlatformDataSchema();
      schemaEnsured = true;
    }

    const lastSynced = new Date().toISOString();

    // ── Analytics tab: return KPI aggregates ─────────────────────────────
    if (ANALYTICS_TABS.has(tab)) {
      const kpiRes = await query<{ metric_key: string; metric_value: string }>(
        `SELECT metric_key, SUM(metric_value)::text AS metric_value
         FROM social_platform_analytics
         WHERE platform = $1
         GROUP BY metric_key
         ORDER BY metric_key`,
        [platform]
      );
      const kpis: Record<string, number | string> = {};
      for (const row of kpiRes.rows) {
        kpis[row.metric_key] = Number(row.metric_value);
      }
      // Fallback KPIs with zeros if no data
      const defaults: Record<string, number> = {
        total_impressions: 0, total_clicks: 0, total_likes: 0,
        total_shares: 0, total_followers: 0, engagement_rate: 0,
      };
      const merged = { ...defaults, ...kpis };

      return NextResponse.json({
        rows: [],
        kpis: merged,
        lastSynced,
        totalRows: 0,
      });
    }

    // ── Review tabs: pull from reputation_review ──────────────────────────
    if (REVIEW_TABS.has(tab)) {
      let statusFilter = '';
      if (tab === 'responses') statusFilter = `AND status = 'responded'`;
      else if (tab === 'flagged') statusFilter = `AND status = 'flagged'`;
      else if (tab === 'invitations') statusFilter = `AND status = 'invited'`;

      const reviewRes = await query<{
        id: string; reviewer_name: string; rating: string;
        title: string; status: string; created_at: string;
      }>(
        `SELECT id, reviewer_name, rating::text, title, status, created_at
         FROM reputation_review
         WHERE platform = $1 ${statusFilter}
         ORDER BY created_at DESC
         LIMIT 50`,
        [platform]
      );
      const countRes = await query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM reputation_review WHERE platform = $1 ${statusFilter}`,
        [platform]
      );

      return NextResponse.json({
        rows: reviewRes.rows.map((r) => ({
          id: r.id,
          reviewer_name: r.reviewer_name,
          rating: r.rating ? Number(r.rating) : null,
          title: r.title,
          status: r.status,
          created_at: r.created_at,
        })),
        lastSynced,
        totalRows: Number(countRes.rows[0]?.c ?? 0),
      });
    }

    // ── Content tabs: pull from unified_content_item ──────────────────────
    const contentTypes = tabToContentTypes(tab);
    const placeholders = contentTypes.map((_, i) => `$${i + 2}`).join(', ');

    const contentRes = await query<{
      id: string; content_type: string; title: string; status: string;
      impressions: string; clicks: string; likes: string; comments: string;
      shares: string; published_at: string; created_at: string;
    }>(
      `SELECT id, content_type, title, status,
              impressions::text, clicks::text, likes::text, comments::text, shares::text,
              published_at, created_at
       FROM unified_content_item
       WHERE platform = $1 AND content_type = ANY(ARRAY[${placeholders}])
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT 50`,
      [platform, ...contentTypes]
    );
    const countRes = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM unified_content_item WHERE platform = $1 AND content_type = ANY(ARRAY[${placeholders}])`,
      [platform, ...contentTypes]
    );

    return NextResponse.json({
      rows: contentRes.rows.map((r) => ({
        id: r.id,
        content_type: r.content_type,
        title: r.title,
        status: r.status,
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        likes: Number(r.likes ?? 0),
        comments: Number(r.comments ?? 0),
        shares: Number(r.shares ?? 0),
        published_at: r.published_at,
        created_at: r.created_at,
      })),
      lastSynced,
      totalRows: Number(countRes.rows[0]?.c ?? 0),
    });
  } catch (err) {
    console.error('[platform-data]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
