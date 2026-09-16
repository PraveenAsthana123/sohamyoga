export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agentops_runs (
        id SERIAL PRIMARY KEY,
        agent_name TEXT NOT NULL,
        task TEXT,
        status TEXT DEFAULT 'running',
        steps_completed INTEGER DEFAULT 0,
        total_steps INTEGER DEFAULT 1,
        cost_usd NUMERIC DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        output TEXT
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM agentops_runs`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO agentops_runs (agent_name, task, status, steps_completed, total_steps, cost_usd, output) VALUES
        ('ContentAgent', 'Generate Q4 blog calendar', 'completed', 8, 8, 0.012, 'Produced 12-post editorial calendar with keywords and outlines'),
        ('SEOAgent', 'Audit top 50 pages for meta tags', 'completed', 50, 50, 0.031, 'Found 18 pages missing OG tags, 7 with duplicate titles'),
        ('AdsAgent', 'Optimize Google Ads bids for Yoga vertical', 'failed', 3, 10, 0.008, 'API rate limit exceeded on bid update call'),
        ('ReportAgent', 'Monthly performance summary', 'completed', 5, 5, 0.005, 'Executive PDF delivered to admin@sohamyoga.com'),
        ('LeadAgent', 'Score and route 200 new leads', 'running', 140, 200, 0.022, NULL)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM agentops_runs ORDER BY started_at DESC`);
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='failed') AS failed,
        COUNT(*) FILTER (WHERE status='running') AS running,
        ROUND(AVG(cost_usd)::numeric,4) AS avg_cost,
        ROUND((COUNT(*) FILTER (WHERE status='completed')::numeric / NULLIF(COUNT(*),0) * 100),1) AS success_rate
      FROM agentops_runs
    `);
    return Response.json({ runs: rows, stats: stats[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const body = await req.json();
  const { agent_name, task, total_steps } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO agentops_runs (agent_name, task, total_steps) VALUES ($1,$2,$3) RETURNING *`,
      [agent_name, task, total_steps ?? 1]
    );
    return Response.json({ run: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
