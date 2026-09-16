import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategic_analysis (
        id SERIAL PRIMARY KEY,
        analysis_type TEXT NOT NULL,
        title TEXT NOT NULL,
        subject TEXT,
        content JSONB NOT NULL DEFAULT '{}',
        ai_insights TEXT,
        status TEXT DEFAULT 'draft',
        version INTEGER DEFAULT 1,
        created_by TEXT,
        reviewed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS strategic_analysis_title_type_uidx
        ON strategic_analysis (title, analysis_type)
    `);

    // Seed SWOT
    await client.query(`
      INSERT INTO strategic_analysis (analysis_type, title, subject, content, status)
      VALUES (
        'SWOT',
        'TalentsHill Platform SWOT',
        'TalentsHill Platform',
        $1,
        'finalized'
      )
      ON CONFLICT (title, analysis_type) DO NOTHING
    `, [JSON.stringify({
      strengths: [
        'Local AI via Ollama — no API costs',
        'Full digital marketing suite in one platform',
        'Open architecture — extensible',
        'Real-time analytics',
      ],
      weaknesses: [
        'No mobile app yet',
        'Limited third-party integrations',
        'Small team',
      ],
      opportunities: [
        'AI regulation driving enterprise demand',
        'SMB digital transformation acceleration',
        'Niche agency market underserved',
      ],
      threats: [
        'HubSpot/Salesforce entering SMB AI space',
        'OpenAI building marketing tools',
        'Economic downturn reducing marketing budgets',
      ],
    })]);

    // Seed PESTEL
    await client.query(`
      INSERT INTO strategic_analysis (analysis_type, title, subject, content, status)
      VALUES (
        'PESTEL',
        'Digital Marketing SaaS Market PESTEL',
        'Digital Marketing SaaS Market',
        $1,
        'finalized'
      )
      ON CONFLICT (title, analysis_type) DO NOTHING
    `, [JSON.stringify({
      political: ['EU AI Act compliance requirements', 'Data sovereignty laws', 'Digital Services Act'],
      economic: ['Rising customer acquisition costs', 'SMB budget constraints post-2024', 'VC funding slowdown for SaaS'],
      social: ['Creator economy growth', 'Remote work driving digital tools', 'Privacy consciousness rising'],
      technological: ['LLM commoditization', 'Edge AI capabilities', 'Real-time personalization at scale'],
      environmental: ['Carbon footprint of AI compute', 'Green hosting demand'],
      legal: ['GDPR enforcement increasing', 'FTC scrutiny of AI marketing claims', 'CCPA expansion'],
    })]);

    // Seed PORTER
    await client.query(`
      INSERT INTO strategic_analysis (analysis_type, title, subject, content, status)
      VALUES (
        'PORTER',
        'Digital Marketing Tools Industry Porter',
        'Digital Marketing Tools Industry',
        $1,
        'finalized'
      )
      ON CONFLICT (title, analysis_type) DO NOTHING
    `, [JSON.stringify({
      competitive_rivalry: {
        intensity: 'high',
        factors: ['HubSpot, Salesforce, Adobe all competing', 'Low switching costs', 'Feature parity converging'],
        rating: 4,
      },
      supplier_power: {
        intensity: 'medium',
        factors: ['Cloud providers (AWS/GCP) have leverage', 'AI model providers (OpenAI) have pricing power', 'Offset by Ollama local AI'],
        rating: 3,
      },
      buyer_power: {
        intensity: 'high',
        factors: ['Many alternatives available', 'Price-sensitive SMB segment', 'Long contract terms reduce power'],
        rating: 4,
      },
      threat_of_substitutes: {
        intensity: 'medium',
        factors: ['In-house teams', 'Freelancers/agencies', 'Point solutions per channel'],
        rating: 3,
      },
      threat_of_new_entrants: {
        intensity: 'low',
        factors: ['High integration complexity', 'Established network effects', 'Data moat advantage'],
        rating: 2,
      },
    })]);

    // Seed AI_STRATEGY
    await client.query(`
      INSERT INTO strategic_analysis (analysis_type, title, subject, content, status)
      VALUES (
        'AI_STRATEGY',
        'TalentsHill AI Strategy',
        'TalentsHill Platform',
        $1,
        'finalized'
      )
      ON CONFLICT (title, analysis_type) DO NOTHING
    `, [JSON.stringify({
      vision: 'Every business decision AI-augmented within 24 months',
      principles: [
        'Local-first AI — Ollama before cloud LLMs',
        'Explainable by default — no black-box decisions',
        'Human-in-loop for high-stakes actions',
        'RAG-grounded — no hallucinated business data',
        'Privacy-preserving — no customer data to third parties',
      ],
      initiatives: [
        { name: 'AI Control Tower', status: 'live', priority: 'P0' },
        { name: 'Ollama RAG Pipeline', status: 'in_progress', priority: 'P0' },
        { name: 'AI Classification Engine', status: 'live', priority: 'P1' },
        { name: 'Reinforcement Learning for Bid Optimization', status: 'planned', priority: 'P2' },
        { name: 'RAGAS Evaluation Framework', status: 'planned', priority: 'P1' },
        { name: 'AI Governance & ISO 42001', status: 'in_progress', priority: 'P0' },
      ],
      governance: {
        framework: 'ISO 42001',
        review_cadence: 'monthly',
        responsible_team: 'AI Control Tower',
      },
    })]);

    // Seed FIRST_PRINCIPLES
    await client.query(`
      INSERT INTO strategic_analysis (analysis_type, title, subject, content, status)
      VALUES (
        'FIRST_PRINCIPLES',
        'Building a Marketing Platform — First Principles',
        'Building a Marketing Platform',
        $1,
        'finalized'
      )
      ON CONFLICT (title, analysis_type) DO NOTHING
    `, [JSON.stringify({
      problem: 'Businesses need to reach and convert customers cost-effectively',
      assumptions_broken: [
        'You need expensive agencies — BROKEN: AI can do 80% of copy generation',
        'You need multiple tools — BROKEN: unified platform reduces context switching',
        'Analytics requires data scientists — BROKEN: natural language querying with LLMs',
        'Personalization requires big data — BROKEN: local models can personalize with small data',
      ],
      first_principles: [
        'A customer converts when perceived value > price + friction',
        'Every marketing action has a measurable signal (clicks, opens, conversions)',
        'Automation of repeatable actions compounds over time',
        'Data owned locally is safer and cheaper than data in third-party clouds',
      ],
      derived_solutions: [
        'AI-generated content reduces creative cost by 70%',
        'Unified DB enables cross-channel attribution without data transfer',
        'Local Ollama eliminates per-token API costs',
        'Open architecture allows any integration',
      ],
    })]);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const { searchParams } = new URL(req.url);
  const analysisType = searchParams.get('analysis_type');

  const client = await pool.connect();
  try {
    const q = analysisType
      ? `SELECT * FROM strategic_analysis WHERE analysis_type = $1 ORDER BY created_at DESC`
      : `SELECT * FROM strategic_analysis ORDER BY created_at DESC`;
    const params = analysisType ? [analysisType] : [];
    const result = await client.query(q, params).catch(() => ({ rows: [] }));
    return Response.json({ analyses: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const body = await req.json() as {
    analysis_type: string;
    title: string;
    subject?: string;
    content?: Record<string, unknown>;
    created_by?: string;
  };

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO strategic_analysis (analysis_type, title, subject, content, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [body.analysis_type, body.title, body.subject ?? null, JSON.stringify(body.content ?? {}), body.created_by ?? null],
    );
    return Response.json({ analysis: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as {
    id: number;
    content?: Record<string, unknown>;
    status?: string;
    ai_insights?: string;
    reviewed_by?: string;
  };

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE strategic_analysis
       SET content = COALESCE($2::jsonb, content),
           status = COALESCE($3, status),
           ai_insights = COALESCE($4, ai_insights),
           reviewed_by = COALESCE($5, reviewed_by),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        body.id,
        body.content ? JSON.stringify(body.content) : null,
        body.status ?? null,
        body.ai_insights ?? null,
        body.reviewed_by ?? null,
      ],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ analysis: result.rows[0] });
  } finally {
    client.release();
  }
}
