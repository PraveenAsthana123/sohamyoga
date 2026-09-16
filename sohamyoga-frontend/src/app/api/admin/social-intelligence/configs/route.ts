import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const sql = platform
    ? `SELECT * FROM social_content_type_config WHERE platform = $1 ORDER BY platform, content_type`
    : `SELECT * FROM social_content_type_config ORDER BY platform, content_type`;
  const result = await query(sql, platform ? [platform] : []);
  return Response.json({ configs: result.rows });
}
