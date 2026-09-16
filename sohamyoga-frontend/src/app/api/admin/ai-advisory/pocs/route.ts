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
      CREATE TABLE IF NOT EXISTS ai_pocs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        use_case TEXT,
        hypothesis TEXT,
        success_criteria TEXT,
        tech_stack TEXT[],
        status TEXT DEFAULT 'proposed',
        findings TEXT,
        recommendation TEXT,
        duration_weeks INTEGER DEFAULT 4,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_pocs`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_pocs (name, use_case, hypothesis, success_criteria, tech_stack, status, findings, recommendation, duration_weeks) VALUES
        ('AI Content Calendar Generator', 'Marketing Automation', 'Ollama llama3.2 can generate a full 30-day content calendar in <2 min at zero marginal cost', 'Generation time <2min, Human approval rate >80%', ARRAY['Ollama','llama3.2','Next.js'], 'completed', 'Generated calendars approved 87% of the time. 4x faster than manual.', 'Proceed to production', 4),
        ('RAG-Powered Class FAQ Bot', 'Customer Support', 'A RAG chatbot trained on FAQ docs can deflect 60% of support tickets', 'Deflection rate >60%, CSAT >4/5', ARRAY['Ollama','nomic-embed-text','pgvector','Next.js'], 'running', NULL, NULL, 6),
        ('AI Lead Scoring Model', 'Sales Intelligence', 'XGBoost trained on CRM history can predict high-value leads with AUC >0.82', 'AUC >0.82, top-20% precision >65%', ARRAY['Python','XGBoost','SHAP','Postgres'], 'proposed', NULL, NULL, 8),
        ('Dynamic Pricing for Class Bookings', 'Revenue Optimization', 'Demand-based dynamic pricing can increase revenue per slot by 15%', 'Revenue/slot +15%, occupancy maintained >80%', ARRAY['Python','scikit-learn','Next.js'], 'proposed', NULL, NULL, 10)
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
    const { rows } = await client.query(`SELECT * FROM ai_pocs ORDER BY created_at DESC`);
    return Response.json({ pocs: rows });
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
  const { name, use_case, hypothesis, success_criteria, tech_stack, duration_weeks } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_pocs (name, use_case, hypothesis, success_criteria, tech_stack, duration_weeks)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, use_case, hypothesis, success_criteria, tech_stack ?? [], duration_weeks ?? 4]
    );
    return Response.json({ poc: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
