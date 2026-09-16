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
      CREATE TABLE IF NOT EXISTS ai_factory_pipelines (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps JSONB DEFAULT '[]',
        trigger_type TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'active',
        last_run TIMESTAMPTZ,
        run_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_factory_pipelines`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_factory_pipelines (name, description, steps, trigger_type, status, run_count) VALUES
        ('Content Generation Pipeline', 'Blog post + social caption + email newsletter from a single topic prompt', '["Input topic","llama3.2: generate outline","llama3.2: expand to full post","llama3.2: generate 5 social captions","llama3.2: write email newsletter","Output to CMS"]', 'manual', 'active', 47),
        ('Lead Enrichment Pipeline', 'Enrich new leads with company data + AI lead score', '["Trigger: new lead created","Fetch company LinkedIn data","llama3.2: score lead 1-10","Update CRM with score","Route high-score leads to sales"]', 'webhook', 'active', 218),
        ('SEO Audit Pipeline', 'Weekly automated SEO health check and improvement suggestions', '["Crawl top 50 pages","Extract meta/content","llama3.2: identify SEO gaps","Generate improvement recommendations","Email report to marketing"]', 'scheduled', 'active', 12)
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
    const { rows } = await client.query(`SELECT * FROM ai_factory_pipelines ORDER BY run_count DESC`);
    return Response.json({ pipelines: rows });
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
  const { name, description, steps, trigger_type } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_factory_pipelines (name, description, steps, trigger_type)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, description, JSON.stringify(steps ?? []), trigger_type ?? 'manual']
    );
    return Response.json({ pipeline: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
