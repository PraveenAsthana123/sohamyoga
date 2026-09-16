import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
interface RetryRow {
  id: number;
  platform: string;
  operation_type: string | null;
  payload: Record<string, unknown>;
  original_error: string | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  status: string;
  last_error: string | null;
  content_item_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await query<RetryRow>(
      `SELECT id, platform, operation_type, payload, original_error, attempt_count, max_attempts,
              next_retry_at, status, last_error, content_item_id, created_at, updated_at
       FROM platform_retry_queue
       WHERE status IN ('pending', 'retrying', 'exhausted')
       ORDER BY
         CASE status WHEN 'retrying' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
         next_retry_at ASC`,
    );
    return Response.json({ rows: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[retry-queue GET]', err);
    return Response.json({ error: 'Failed to fetch retry queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as {
      platform: string;
      operation_type: string;
      payload?: Record<string, unknown>;
      original_error?: string;
      max_attempts?: number;
      content_item_id?: number;
    };

    const result = await query<{ id: number }>(
      `INSERT INTO platform_retry_queue
         (platform, operation_type, payload, original_error, max_attempts, content_item_id, status, next_retry_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING id`,
      [
        body.platform,
        body.operation_type,
        JSON.stringify(body.payload ?? {}),
        body.original_error ?? null,
        body.max_attempts ?? 3,
        body.content_item_id ?? null,
      ],
    );
    return Response.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('[retry-queue POST]', err);
    return Response.json({ error: 'Failed to add retry item' }, { status: 500 });
  }
}
