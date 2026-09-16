import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

async function generateInsights(projectName: string, category: string, industry: string): Promise<Array<{type:string;title:string;body:string;confidence:number}>> {
  const prompt = `You are a market research analyst. Generate exactly 5 market insights for:
Project: ${projectName}
Category: ${category}
Industry: ${industry}

Return ONLY valid JSON array (no markdown, no explanation):
[
  {"type": "trend|opportunity|threat|gap|benchmark|prediction", "title": "...", "body": "2-3 sentences.", "confidence": 0.00-1.00},
  ...5 items total
]`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: 0.7, num_predict: 1000 } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const json = await res.json() as { response: string };
    const text = json.response.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    return JSON.parse(match[0]) as Array<{type:string;title:string;body:string;confidence:number}>;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get('project_id');
  const insightType = url.searchParams.get('type');

  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (projectId) { conditions.push(`project_id = $${vals.length + 1}`); vals.push(projectId); }
  if (insightType) { conditions.push(`insight_type = $${vals.length + 1}`); vals.push(insightType); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<{
    id: string; project_id: string; insight_type: string; title: string; body: string;
    confidence_score: string; source: string; ai_generated: boolean; tags: string; created_at: string;
  }>(`SELECT * FROM market_insight ${where} ORDER BY confidence_score DESC, created_at DESC`, vals);

  return Response.json({
    insights: rows.rows.map(r => ({
      id: Number(r.id), projectId: r.project_id ? Number(r.project_id) : null,
      insightType: r.insight_type, title: r.title, body: r.body,
      confidenceScore: Number(r.confidence_score), source: r.source,
      aiGenerated: r.ai_generated, tags: r.tags, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    project_id?: number; generate?: boolean;
    insight_type?: string; title?: string; body_text?: string;
    confidence_score?: number; source?: string; tags?: string;
  } | null;

  if (!body) return Response.json({ error: 'Body required.' }, { status: 400 });

  // AI generation mode
  if (body.generate && body.project_id) {
    const projRows = await query<{ name: string; category: string; industry: string }>(
      `SELECT name, category, industry FROM market_research_project WHERE id = $1`, [body.project_id],
    );
    if (!projRows.rowCount) return Response.json({ error: 'Project not found.' }, { status: 404 });
    const p = projRows.rows[0];

    const insights = await generateInsights(p.name, p.category, p.industry);
    const ids: number[] = [];
    for (const insight of insights) {
      const r = await query<{ id: string }>(
        `INSERT INTO market_insight (project_id, insight_type, title, body, confidence_score, source, ai_generated)
         VALUES ($1,$2,$3,$4,$5,'AI Generated',true) RETURNING id`,
        [body.project_id, insight.type, insight.title, insight.body, Math.min(1, Math.max(0, insight.confidence))],
      );
      ids.push(Number(r.rows[0].id));
    }
    return Response.json({ generated: ids.length, ids }, { status: 201 });
  }

  // Manual mode
  if (!body.title?.trim()) return Response.json({ error: 'title is required.' }, { status: 400 });

  const result = await query<{ id: string }>(
    `INSERT INTO market_insight (project_id, insight_type, title, body, confidence_score, source, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      body.project_id ?? null,
      body.insight_type ?? 'trend',
      body.title.trim(),
      body.body_text ?? '',
      body.confidence_score ?? 0.75,
      body.source ?? '',
      body.tags ?? '',
    ],
  );
  return Response.json({ id: Number(result.rows[0].id) }, { status: 201 });
}
