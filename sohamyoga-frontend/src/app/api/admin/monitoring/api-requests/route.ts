import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS api_request_log (
    id BIGSERIAL PRIMARY KEY,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INT,
    duration_ms INT,
    ip_address TEXT,
    user_agent TEXT,
    request_body_size INT,
    response_body_size INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const method = searchParams.get('method') ?? '';
  const statusCode = searchParams.get('statusCode') ?? '';
  const path = searchParams.get('path') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (method) {
      conditions.push(`method = $${values.length + 1}`);
      values.push(method.toUpperCase());
    }
    if (statusCode) {
      conditions.push(`status_code = $${values.length + 1}`);
      values.push(parseInt(statusCode, 10));
    }
    if (path) {
      conditions.push(`path ILIKE $${values.length + 1}`);
      values.push(`%${path}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      client.query(
        `SELECT id, method, path, status_code, duration_ms, ip_address, user_agent,
                request_body_size, response_body_size, created_at
         FROM api_request_log ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, pageSize, offset],
      ),
      client.query(
        `SELECT COUNT(*)::int AS total FROM api_request_log ${where}`,
        values,
      ),
    ]);

    return Response.json({
      items: rows.rows,
      total: countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    });
  } finally {
    client.release();
  }
}
