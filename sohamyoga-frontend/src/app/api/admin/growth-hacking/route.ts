export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTable(client: import('pg').PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS growth_experiments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    channel TEXT,
    metric TEXT,
    baseline_value NUMERIC,
    target_value NUMERIC,
    actual_value NUMERIC,
    start_date DATE,
    end_date DATE,
    result TEXT,
    learnings TEXT,
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
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conditions.push(`status=$${params.length}`); }
    if (channel) { params.push(channel); conditions.push(`channel=$${params.length}`); }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const r = await client.query(`SELECT * FROM growth_experiments${where} ORDER BY created_at DESC`, params);
    const statsR = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='running') AS running,
        COUNT(*) FILTER (WHERE result='won') AS won,
        COUNT(*) FILTER (WHERE result='lost') AS lost,
        ROUND(AVG(
          CASE WHEN actual_value IS NOT NULL AND baseline_value IS NOT NULL AND baseline_value != 0
          THEN ((actual_value - baseline_value) / baseline_value * 100)
          ELSE NULL END
        ), 1) AS uplift_avg,
        COUNT(DISTINCT channel) FILTER (WHERE channel IS NOT NULL) AS channels_tested
      FROM growth_experiments
    `);
    return Response.json({ experiments: r.rows, stats: statsR.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { name, hypothesis, channel, metric, baseline_value, target_value, start_date, end_date } = body;
  if (!name || !hypothesis) return Response.json({ error: 'name and hypothesis required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const r = await client.query(
      `INSERT INTO growth_experiments (name, hypothesis, channel, metric, baseline_value, target_value, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, hypothesis, channel || null, metric || null, baseline_value || null, target_value || null, start_date || null, end_date || null]
    );
    return Response.json(r.rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
