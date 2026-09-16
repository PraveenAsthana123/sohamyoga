export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS benchmark_result (
        id SERIAL PRIMARY KEY,
        benchmark_name TEXT NOT NULL,
        category TEXT DEFAULT 'api',
        metric_name TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT DEFAULT 'ms',
        baseline_value NUMERIC,
        delta_pct NUMERIC,
        status TEXT DEFAULT 'pass',
        environment TEXT DEFAULT 'local',
        run_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS benchmark_result_name_day_idx
      ON benchmark_result(benchmark_name, DATE_TRUNC('day', run_at))
    `);

    const seeds: [string, string, string, number, string, number][] = [
      ['API Health Check', 'api', 'p50_latency_ms', 45, 'ms', 50],
      ['DB Query Simple SELECT', 'db', 'p50_latency_ms', 8, 'ms', 10],
      ['DB Query Complex JOIN', 'db', 'p50_latency_ms', 35, 'ms', 40],
      ['Ollama llama3.2 inference', 'ai', 'p50_latency_ms', 2800, 'ms', 3000],
      ['Ollama embedding', 'ai', 'p50_latency_ms', 120, 'ms', 150],
      ['Next.js page render', 'frontend', 'p50_latency_ms', 180, 'ms', 200],
      ['Cron job avg duration', 'job', 'p50_latency_ms', 450, 'ms', 500],
      ['Pipeline stage throughput', 'pipeline', 'throughput_rps', 120, 'rps', 100],
      ['Auth token validation', 'api', 'p50_latency_ms', 12, 'ms', 15],
      ['Customer event ingestion', 'api', 'throughput_rps', 850, 'rps', 1000],
    ];

    for (const [name, cat, metric, value, unit, baseline] of seeds) {
      const delta = baseline > 0 ? ((value - baseline) / baseline) * 100 : 0;
      const status = delta > 20 ? 'fail' : delta > 5 ? 'warn' : 'pass';
      await client.query(
        `INSERT INTO benchmark_result (benchmark_name, category, metric_name, value, unit, baseline_value, delta_pct, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (benchmark_name, DATE_TRUNC('day', run_at)) DO NOTHING`,
        [name, cat, metric, value, unit, baseline, parseFloat(delta.toFixed(2)), status]
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema().catch(() => {});

  const url = new URL(req.url);
  const category = url.searchParams.get('category');

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (category) { conditions.push(`category = $1`); params.push(category); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT DISTINCT ON (benchmark_name) *
       FROM benchmark_result
       ${where}
       ORDER BY benchmark_name, run_at DESC`,
      params
    ).catch(() => ({ rows: [] }));

    const history = await client.query(
      `SELECT benchmark_name, value, unit, run_at, status FROM benchmark_result ORDER BY run_at ASC`
    ).catch(() => ({ rows: [] }));

    return Response.json({ benchmarks: rows, history: history.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema().catch(() => {});

  const body = await req.json().catch(() => ({}));
  const { benchmark_name, category, metric_name, value, unit, baseline_value, environment, notes } = body;
  if (!benchmark_name || value === undefined) return Response.json({ error: 'benchmark_name and value are required' }, { status: 400 });

  const bv = baseline_value !== undefined ? Number(baseline_value) : null;
  const v = Number(value);
  let delta: number | null = null;
  let status = 'pass';
  if (bv !== null && bv > 0) {
    delta = parseFloat((((v - bv) / bv) * 100).toFixed(2));
    status = delta > 20 ? 'fail' : delta > 5 ? 'warn' : 'pass';
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO benchmark_result (benchmark_name, category, metric_name, value, unit, baseline_value, delta_pct, status, environment, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [benchmark_name, category || 'api', metric_name || 'p50_latency_ms', v, unit || 'ms', bv, delta, status, environment || 'local', notes || null]
    ).catch(() => ({ rows: [] }));
    return Response.json({ benchmark: rows[0], delta_pct: delta, status }, { status: 201 });
  } finally {
    client.release();
  }
}
