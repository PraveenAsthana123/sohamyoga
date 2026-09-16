import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

async function generateWithOllama(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: 0.7, num_predict: 2500 } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const json = await res.json() as { response: string };
    return json.response.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    project_id?: number; report_type?: 'short' | 'detailed'; focus?: string;
  } | null;

  if (!body?.project_id) {
    return Response.json({ error: 'project_id is required.' }, { status: 400 });
  }

  const projRows = await query<{
    id: string; name: string; category: string; target_market: string;
    industry: string; geography: string;
  }>(`SELECT id, name, category, target_market, industry, geography FROM market_research_project WHERE id = $1`, [body.project_id]);

  if (!projRows.rowCount) return Response.json({ error: 'Project not found.' }, { status: 404 });
  const p = projRows.rows[0];

  const reportType = body.report_type ?? 'short';
  const focus = body.focus ?? p.name;

  const prompts: Record<string, string> = {
    short: `You are a market research analyst. Write a SHORT research report (400-600 words) for:
Project: ${p.name}
Category: ${p.category}
Target Market: ${p.target_market}
Industry: ${p.industry}
Focus: ${focus}

Include: Executive Summary, 3 Key Findings, Market Opportunity, Recommended Next Steps.
Format as structured markdown.`,

    detailed: `You are a senior market research analyst. Write a DETAILED research report (1500-2000 words) for:
Project: ${p.name}
Category: ${p.category}
Target Market: ${p.target_market}
Industry: ${p.industry}
Geography: ${p.geography}
Focus: ${focus}

Include: 1. Executive Summary, 2. Market Overview & Size, 3. Competitive Landscape, 4. Customer Segmentation, 5. Trend Analysis, 6. SWOT Analysis, 7. Growth Opportunities, 8. Risk Factors, 9. Strategic Recommendations, 10. Appendix: Data Sources.
Format as professional structured markdown with headers and bullet points.`,
  };

  const content = await generateWithOllama(prompts[reportType] ?? prompts.short);
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const title = `${reportType === 'short' ? 'Short' : 'Detailed'} Report: ${focus}`;
  const documentType = reportType === 'short' ? 'short_report' : 'detailed_report';

  const inserted = await query<{ id: string }>(
    `INSERT INTO market_research_document
       (project_id, document_type, title, content, format, word_count, generated_by)
     VALUES ($1,$2,$3,$4,'markdown',$5,'ai')
     RETURNING id`,
    [body.project_id, documentType, title, content, wordCount],
  );

  return Response.json({
    id: Number(inserted.rows[0].id),
    title,
    content,
    wordCount,
    documentType,
    generatedBy: 'ai',
  }, { status: 201 });
}
