import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ prompts: [], evals: [], summary: { totalPrompts: 0, championPrompts: 0, avgAcceptance: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_version (
        id SERIAL PRIMARY KEY,
        prompt_name TEXT NOT NULL,
        version TEXT,
        content TEXT,
        model TEXT DEFAULT 'ollama/llama3',
        grounding_pct NUMERIC(5,2) DEFAULT 0,
        acceptance_pct NUMERIC(5,2) DEFAULT 0,
        avg_tokens INTEGER DEFAULT 0,
        avg_cost_cents NUMERIC(8,4) DEFAULT 0,
        avg_latency_ms INTEGER DEFAULT 0,
        is_champion BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS llm_eval (
        id SERIAL PRIMARY KEY,
        prompt_id INTEGER REFERENCES prompt_version(id) ON DELETE SET NULL,
        eval_type TEXT,
        score NUMERIC(5,2),
        evaluator TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [promptsRes, evalsRes] = await Promise.all([
      client.query(`SELECT * FROM prompt_version ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT le.*, pv.prompt_name FROM llm_eval le LEFT JOIN prompt_version pv ON pv.id = le.prompt_id ORDER BY le.created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const prompts: Array<{ is_champion: boolean; acceptance_pct: number }> = promptsRes.rows;
    const summary = {
      totalPrompts: prompts.length,
      championPrompts: prompts.filter(p => p.is_champion).length,
      avgAcceptance: prompts.length > 0
        ? Math.round(prompts.reduce((s, p) => s + Number(p.acceptance_pct ?? 0), 0) / prompts.length)
        : 0,
    };

    return Response.json({ prompts: promptsRes.rows, evals: evalsRes.rows, summary });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'set_champion' && body.prompt_id) {
      await client.query(`UPDATE prompt_version SET is_champion = false WHERE prompt_name = (SELECT prompt_name FROM prompt_version WHERE id = $1)`, [body.prompt_id]);
      await client.query(`UPDATE prompt_version SET is_champion = true WHERE id = $1`, [body.prompt_id]);
      return Response.json({ ok: true });
    }
    const result = await client.query(
      `INSERT INTO prompt_version (prompt_name, version, content, model, status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.prompt_name ?? '', body.version ?? '1.0', body.content ?? '', body.model ?? 'ollama/llama3', body.status ?? 'draft']
    );
    return Response.json({ prompt: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
