export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTable(client: import('pg').PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS publishing_calendar (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL,
    platform TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft',
    content_body TEXT,
    tags TEXT[],
    assigned_to TEXT,
    campaign_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const platform = searchParams.get('platform');
    const content_type = searchParams.get('content_type');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (month) {
      params.push(`${month}%`);
      conditions.push(`scheduled_at::text LIKE $${params.length}`);
    }
    if (platform) {
      params.push(platform);
      conditions.push(`platform = $${params.length}`);
    }
    if (content_type) {
      params.push(content_type);
      conditions.push(`content_type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM publishing_calendar${where} ORDER BY scheduled_at ASC NULLS LAST LIMIT 200`;
    const r = await client.query(sql, params);

    // Stats for current month
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const statsR = await client.query(
      `SELECT
        COUNT(*) FILTER (WHERE scheduled_at::text LIKE $1) AS total_month,
        COUNT(*) FILTER (WHERE scheduled_at::text LIKE $1 AND status='published') AS published,
        COUNT(*) FILTER (WHERE scheduled_at::text LIKE $1 AND status='scheduled') AS scheduled,
        COUNT(*) FILTER (WHERE scheduled_at::text LIKE $1 AND status='draft') AS draft
       FROM publishing_calendar`,
      [`${currentMonth}%`]
    );

    return Response.json({ items: r.rows, stats: statsR.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { title, content_type, platform, scheduled_at, content_body, tags, assigned_to, campaign_id } = body;
  if (!title || !content_type) {
    return Response.json({ error: 'title and content_type required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const r = await client.query(
      `INSERT INTO publishing_calendar (title, content_type, platform, scheduled_at, content_body, tags, assigned_to, campaign_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, content_type, platform || null, scheduled_at || null, content_body || null, tags || null, assigned_to || null, campaign_id || null]
    );
    return Response.json(r.rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
