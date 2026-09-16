export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  profile_url: string | null;
  avatar_url: string | null;
  status: string;
  connected_at: string | null;
  last_health_check_at: string | null;
  error_message: string | null;
}

interface ContentDraft {
  id: string;
  content_type: string;
  master_text: string;
  status: string;
  default_schedule_at: string | null;
  generated_with_ai: boolean;
  tags: string[];
  created_at: string;
}

interface SocialPost {
  id: string;
  platform: string;
  status: string;
  scheduled_at: string;
  published_at: string | null;
  external_post_url: string | null;
  created_at: string;
}

interface PlatformAnalytic {
  id: string;
  platform: string;
  metric_key: string;
  metric_value: number;
  recorded_at: string;
}

interface SocialCampaign {
  id: string;
  name: string;
  goal: string;
  status: string;
  platforms: string[];
  starts_at: string;
  ends_at: string;
  budget: number | null;
  created_at: string;
}

interface Summary {
  connectedAccounts: number;
  totalDrafts: number;
  totalPosts: number;
  activeCampaigns: number;
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [accountsRes, draftsRes, postsRes, analyticsRes, campaignsRes] = await Promise.all([
      client.query<SocialAccount>(`
        SELECT id, platform, account_name, profile_url, avatar_url, status,
               connected_at, last_health_check_at, error_message
        FROM social_account
        ORDER BY platform, account_name
      `).catch(() => ({ rows: [] as SocialAccount[] })),

      client.query<ContentDraft>(`
        SELECT id, content_type, master_text, status, default_schedule_at,
               generated_with_ai, tags, created_at
        FROM social_content_draft
        ORDER BY created_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] as ContentDraft[] })),

      client.query<SocialPost>(`
        SELECT id, platform, status, scheduled_at, published_at,
               external_post_url, created_at
        FROM social_post
        ORDER BY created_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] as SocialPost[] })),

      client.query<PlatformAnalytic>(`
        SELECT id, platform, metric_key, metric_value, recorded_at
        FROM social_platform_analytics
        ORDER BY recorded_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] as PlatformAnalytic[] })),

      client.query<SocialCampaign>(`
        SELECT id, name, goal, status, platforms, starts_at, ends_at, budget, created_at
        FROM social_campaign
        ORDER BY created_at DESC
        LIMIT 100
      `).catch(() => ({ rows: [] as SocialCampaign[] })),
    ]);

    const accounts = accountsRes.rows;
    const campaigns = campaignsRes.rows;

    const summary: Summary = {
      connectedAccounts: accounts.filter((a) => a.status === 'active').length,
      totalDrafts: draftsRes.rows.length,
      totalPosts: postsRes.rows.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
    };

    return Response.json({
      accounts,
      drafts: draftsRes.rows,
      posts: postsRes.rows,
      analytics: analyticsRes.rows,
      campaigns,
      summary,
    });
  } finally {
    client.release();
  }
}
