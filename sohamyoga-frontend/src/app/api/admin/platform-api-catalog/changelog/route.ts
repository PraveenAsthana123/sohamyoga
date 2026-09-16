import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensurePlatformApiCatalogSchema();
  const sp = req.nextUrl.searchParams;
  const platform = sp.get('platform');
  const change_type = sp.get('change_type');
  const impact = sp.get('impact');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  if (change_type) { conditions.push(`change_type = $${idx++}`); params.push(change_type); }
  if (impact) { conditions.push(`impact = $${idx++}`); params.push(impact); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM platform_api_changelog ${where} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return Response.json({ entries: result.rows, total: result.rowCount });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensurePlatformApiCatalogSchema();
  const body = await req.json() as Record<string, unknown>;
  const {
    platform, change_type, endpoint_path, description, effective_date,
    impact, our_action_required, our_action_taken, source_url,
  } = body;

  if (!platform || !change_type || !description) {
    return Response.json({ error: 'platform, change_type, description are required' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO platform_api_changelog
       (platform, change_type, endpoint_path, description, effective_date, impact, our_action_required, our_action_taken, source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      platform, change_type, endpoint_path ?? null, description,
      effective_date ?? null, impact ?? 'medium',
      our_action_required ?? false, our_action_taken ?? null, source_url ?? null,
    ],
  );
  return Response.json({ entry: result.rows[0] }, { status: 201 });
}
