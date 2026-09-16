import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

export async function GET(req: NextRequest) {
  await ensurePlatformApiCatalogSchema();
  const sp = req.nextUrl.searchParams;
  const platform = sp.get('platform');
  const category = sp.get('category');
  const status = sp.get('status');
  const auth_type = sp.get('auth_type');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
  if (status) { conditions.push(`implementation_status = $${idx++}`); params.push(status); }
  if (auth_type) { conditions.push(`auth_type = $${idx++}`); params.push(auth_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM platform_api_offering ${where} ORDER BY platform, category, http_method, endpoint_path`,
    params,
  );
  return NextResponse.json({ offerings: result.rows, total: result.rowCount });
}

export async function POST(req: NextRequest) {
  await ensurePlatformApiCatalogSchema();
  const body = await req.json() as Record<string, unknown>;
  const {
    platform, api_version, api_name, endpoint_path, http_method, capability,
    category, auth_type, required_scopes, required_env_vars,
    rate_limit_calls, rate_limit_window, rate_limit_tier,
    implementation_status, our_api_route, is_stable, requires_review,
    data_returned, example_request, example_response, notes,
  } = body;

  if (!platform || !api_name || !endpoint_path || !http_method || !capability || !category || !auth_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO platform_api_offering
       (platform, api_version, api_name, endpoint_path, http_method, capability,
        category, auth_type, required_scopes, required_env_vars,
        rate_limit_calls, rate_limit_window, rate_limit_tier,
        implementation_status, our_api_route, is_stable, requires_review,
        data_returned, example_request, example_response, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING *`,
    [
      platform, api_version ?? null, api_name, endpoint_path, http_method, capability,
      category, auth_type, required_scopes ?? [], required_env_vars ?? [],
      rate_limit_calls ?? null, rate_limit_window ?? null, rate_limit_tier ?? 'default',
      implementation_status ?? 'not_built', our_api_route ?? null,
      is_stable ?? true, requires_review ?? false,
      data_returned ?? [], example_request ?? {}, example_response ?? {}, notes ?? null,
    ],
  );
  return NextResponse.json({ offering: result.rows[0] }, { status: 201 });
}
