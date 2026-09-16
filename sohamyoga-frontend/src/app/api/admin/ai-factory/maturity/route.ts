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
      CREATE TABLE IF NOT EXISTS ai_maturity_scores (
        id SERIAL PRIMARY KEY,
        dimension TEXT UNIQUE NOT NULL,
        current_score INTEGER DEFAULT 1,
        target_score INTEGER DEFAULT 5,
        evidence TEXT,
        gap_actions TEXT[],
        assessed_at DATE DEFAULT CURRENT_DATE
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_maturity_scores`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_maturity_scores (dimension, current_score, target_score, evidence, gap_actions) VALUES
        ('Strategy', 3, 5, 'AI roadmap defined for 2026-2027; PoC process established; no dedicated Chief AI Officer', ARRAY['Hire or appoint Chief AI Officer','Define 3-year AI investment budget','Establish AI OKRs at executive level']),
        ('Data', 2, 5, 'CRM and booking data in Postgres; no feature store; inconsistent data quality across sources', ARRAY['Implement data quality monitoring','Build unified customer data platform','Deploy vector DB for RAG workloads']),
        ('Technology', 4, 5, 'Ollama local inference live; RAG pipeline running; Next.js AI APIs operational; no MLOps platform', ARRAY['Deploy MLflow for experiment tracking','Implement model monitoring and drift detection','Build CI/CD for model deployment']),
        ('People', 2, 5, '1 ML-capable developer; no data scientist; AI literacy program started with 42 enrolled', ARRAY['Hire senior ML engineer','Train 50% of staff on AI basics by Q1 2027','Create AI Center of Excellence']),
        ('Governance', 3, 5, 'AI guardrails live (8 rules); privacy assessments done; no formal AI ethics board', ARRAY['Establish AI Ethics & Risk Committee','Complete EU AI Act readiness assessment','Implement automated compliance monitoring']),
        ('Culture', 2, 5, 'Leadership AI-curious; Innovation Lab launched; 8 ideas submitted; low adoption of AI tools day-to-day', ARRAY['Run AI hackathon to build momentum','Share weekly AI wins in company meeting','Make AI tool usage part of role KPIs'])
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
    const { rows } = await client.query(`SELECT * FROM ai_maturity_scores ORDER BY id`);
    return Response.json({ maturity: rows });
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
  const { dimension, current_score, target_score, evidence, gap_actions } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_maturity_scores (dimension, current_score, target_score, evidence, gap_actions)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (dimension) DO UPDATE SET current_score=$2, evidence=$4, gap_actions=$5, assessed_at=CURRENT_DATE
       RETURNING *`,
      [dimension, current_score ?? 1, target_score ?? 5, evidence, gap_actions ?? []]
    );
    return Response.json({ score: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
