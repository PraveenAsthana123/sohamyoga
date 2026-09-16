import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const polarity = req.nextUrl.searchParams.get('polarity');
  const content_type = req.nextUrl.searchParams.get('content_type');
  const status = req.nextUrl.searchParams.get('status');

  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;
  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  if (polarity) { conditions.push(`polarity = $${idx++}`); params.push(polarity); }
  if (content_type) { conditions.push(`content_type = $${idx++}`); params.push(content_type); }
  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM social_test_scenario ${where} ORDER BY platform, content_type, polarity`,
    params,
  );

  const total = result.rowCount ?? 0;
  const passed = result.rows.filter(r => r.status === 'pass').length;
  const failed = result.rows.filter(r => r.status === 'fail').length;

  return Response.json({
    scenarios: result.rows,
    summary: { total, passed, failed, pending: total - passed - failed },
  });
}
