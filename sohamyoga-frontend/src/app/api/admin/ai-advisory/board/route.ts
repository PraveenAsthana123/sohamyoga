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
      CREATE TABLE IF NOT EXISTS board_briefings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        audience TEXT,
        key_messages TEXT[],
        risk_items TEXT[],
        investment_ask NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'draft',
        scheduled_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM board_briefings`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO board_briefings (title, audience, key_messages, risk_items, investment_ask, status, scheduled_date) VALUES
        ('Q3 AI Strategy Review', 'Board of Directors', ARRAY['3 PoCs completed this quarter','AI automation saving 40h/month','Local Ollama deployment de-risked vendor lock-in'], ARRAY['Model hallucination in customer-facing chatbot','Data privacy gap in marketing AI'], 150000, 'delivered', '2026-09-01'),
        ('AI Investment Case for 2027', 'Executive Leadership', ARRAY['AI-first roadmap projected 35% efficiency gain','RAG deployment reduces support tickets by 60%','Competitor AI gap analysis shows 18-month advantage'], ARRAY['Talent shortage — 2 ML engineers needed','Regulatory compliance costs for GDPR AI Act'], 500000, 'approved', '2026-09-15'),
        ('AI Risk & Governance Update', 'Risk Committee', ARRAY['Red team testing now quarterly','Guardrails covering 8 risk categories','PIPEDA compliance assessment completed'], ARRAY['EU AI Act high-risk classification pending','Board oversight structure not yet formalized'], 0, 'draft', '2026-10-01')
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
    const { rows } = await client.query(`SELECT * FROM board_briefings ORDER BY scheduled_date DESC`);
    return Response.json({ briefings: rows });
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
  const { title, audience, key_messages, risk_items, investment_ask, scheduled_date } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO board_briefings (title, audience, key_messages, risk_items, investment_ask, scheduled_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, audience, key_messages ?? [], risk_items ?? [], investment_ask ?? 0, scheduled_date]
    );
    return Response.json({ briefing: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
