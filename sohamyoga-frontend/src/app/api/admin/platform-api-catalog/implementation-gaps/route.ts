import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

import { requireAdmin } from '@/lib/admin-auth';
// Priority weights: higher = more important to build
const CATEGORY_PRIORITY: Record<string, number> = {
  publish: 10, analytics: 9, messaging: 8, read: 7,
  review: 6, campaign: 5, insight: 4, webhook: 3, auth: 2, media: 2,
};

const PLATFORM_PRIORITY: Record<string, number> = {
  facebook: 10, instagram: 10, youtube: 9, x_twitter: 9, linkedin: 9,
  tiktok: 8, whatsapp_business: 8, pinterest: 7, reddit: 7,
  discord: 7, telegram: 7, google_business: 6, trustpilot: 6,
  medium: 5, vimeo: 5, patreon: 5, github: 4, bluesky: 4,
  mastodon: 4, threads: 4, twitch: 3, tumblr: 3, soundcloud: 3,
  spotify: 3, apple_podcasts: 3, dailymotion: 2, snapchat: 2,
  yelp: 2, tripadvisor: 2, gitlab: 2, substack: 2,
  stackoverflow: 1, quora: 1,
};

const EFFORT_ESTIMATE: Record<string, string> = {
  messaging: 'Medium', publish: 'Medium', analytics: 'High',
  read: 'Low', review: 'Medium', campaign: 'High',
  auth: 'Low', webhook: 'Medium', insight: 'High', media: 'Medium',
};

interface GapRow {
  id: string;
  platform: string;
  category: string;
  capability: string;
  http_method: string;
  endpoint_path: string;
  implementation_status: string;
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensurePlatformApiCatalogSchema();

  const result = await query<GapRow>(
    `SELECT id, platform, category, capability, http_method, endpoint_path, implementation_status
     FROM platform_api_offering
     WHERE implementation_status IN ('not_built', 'stub')
     ORDER BY platform, category`,
    [],
  );

  const gaps = result.rows.map((row) => {
    const catPriority = CATEGORY_PRIORITY[row.category] ?? 1;
    const platPriority = PLATFORM_PRIORITY[row.platform] ?? 1;
    const businessImpact = catPriority * platPriority;
    const effort = EFFORT_ESTIMATE[row.category] ?? 'Medium';

    return {
      id: row.id,
      platform: row.platform,
      category: row.category,
      capability: row.capability,
      http_method: row.http_method,
      endpoint_path: row.endpoint_path,
      current_status: row.implementation_status,
      estimated_effort: effort,
      business_impact: businessImpact,
      platform_priority: platPriority,
      category_priority: catPriority,
    };
  });

  // Sort by business_impact descending
  gaps.sort((a, b) => b.business_impact - a.business_impact);

  const top10 = gaps.slice(0, 10);

  return Response.json({ gaps, top10, total: gaps.length });
}
