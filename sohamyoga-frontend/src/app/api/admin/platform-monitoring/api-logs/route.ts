import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  const isError = searchParams.get('is_error');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (platform) {
    conditions.push(`platform = $${idx++}`);
    values.push(platform);
  }
  if (isError === 'true') {
    conditions.push(`is_error = true`);
  }
  if (dateFrom) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`created_at <= $${idx++}`);
    values.push(dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query<ApiLogRow>(
      `SELECT id, platform, endpoint, http_method, request_headers, request_body,
              response_status, response_body, response_headers, duration_ms,
              is_error, error_type, triggered_by, content_item_id, created_at
       FROM platform_api_log
       ${where}
       ORDER BY created_at DESC
       LIMIT 200`,
      values,
    );
    return NextResponse.json({ rows: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[api-logs GET]', err);
    return NextResponse.json({ error: 'Failed to fetch API logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      platform: string;
      endpoint: string;
      http_method?: string;
      response_status?: number;
      response_body?: string;
      duration_ms?: number;
      is_error?: boolean;
      error_type?: string;
      triggered_by?: string;
    };

    const result = await query<{ id: number }>(
      `INSERT INTO platform_api_log
         (platform, endpoint, http_method, response_status, response_body, duration_ms, is_error, error_type, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        body.platform,
        body.endpoint,
        body.http_method ?? 'GET',
        body.response_status ?? 200,
        body.response_body ?? null,
        body.duration_ms ?? null,
        body.is_error ?? false,
        body.error_type ?? null,
        body.triggered_by ?? 'manual_test',
      ],
    );
    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('[api-logs POST]', err);
    return NextResponse.json({ error: 'Failed to insert log' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await query(`TRUNCATE TABLE platform_api_log`);
    return NextResponse.json({ success: true, message: 'All API logs cleared' });
  } catch (err) {
    console.error('[api-logs DELETE]', err);
    return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
  }
}
