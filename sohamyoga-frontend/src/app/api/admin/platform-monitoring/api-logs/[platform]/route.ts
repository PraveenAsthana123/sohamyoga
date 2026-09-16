import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
interface ApiLogRow {
  id: number;
  platform: string;
  endpoint: string;
  http_method: string | null;
  request_headers: Record<string, string>;
  request_body: string | null;
  response_status: number | null;
  response_body: string | null;
  response_headers: Record<string, string>;
  duration_ms: number | null;
  is_error: boolean;
  error_type: string | null;
  triggered_by: string | null;
  content_item_id: number | null;
  created_at: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  try {
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM platform_api_log WHERE platform = $1`,
      [platform],
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const result = await query<ApiLogRow>(
      `SELECT id, platform, endpoint, http_method, request_headers, request_body,
              response_status, response_body, response_headers, duration_ms,
              is_error, error_type, triggered_by, content_item_id, created_at
       FROM platform_api_log
       WHERE platform = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [platform, limit, offset],
    );

    return Response.json({
      platform,
      rows: result.rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[api-logs/platform]', err);
    return Response.json({ error: 'Failed to fetch platform logs' }, { status: 500 });
  }
}
