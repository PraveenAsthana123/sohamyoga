import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';
import { SERVER_API_URL } from '@/lib/server-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as { id: number };
  if (!body.id) return Response.json({ error: 'id is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const row = await client.query(
      `SELECT * FROM strategic_analysis WHERE id = $1`,
      [body.id],
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

    if (!row.rows.length) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const analysis = row.rows[0] as {
      id: number;
      analysis_type: string;
      title: string;
      subject: string;
      content: Record<string, unknown>;
    };

    const contentSummary = JSON.stringify(analysis.content, null, 2).slice(0, 3000);
    const prompt = `You are a senior business strategist. Analyze the following ${analysis.analysis_type} analysis for "${analysis.subject ?? analysis.title}" and provide 3-5 concise, actionable strategic insights. Be specific, data-driven, and practical.

Framework: ${analysis.analysis_type}
Subject: ${analysis.subject ?? analysis.title}
Content:
${contentSummary}

Provide insights in the following format:
1. [Insight title]: [2-3 sentence explanation with specific recommendation]
Keep each insight under 80 words. Focus on what should be DONE next.`;

    let aiInsights = '';
    try {
      const aiResponse = await fetch(`${SERVER_API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({ prompt, max_tokens: 600 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (aiResponse.ok) {
        const aiData = await aiResponse.json() as { text?: string; response?: string; result?: string };
        aiInsights = aiData.text ?? aiData.response ?? aiData.result ?? '';
      } else {
        aiInsights = `[AI service unavailable — HTTP ${aiResponse.status}]`;
      }
    } catch {
      aiInsights = '[AI service unavailable — could not reach /api/ai/generate]';
    }

    const updated = await client.query(
      `UPDATE strategic_analysis
       SET ai_insights = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [body.id, aiInsights],
    );

    return Response.json({ analysis: updated.rows[0] });
  } finally {
    client.release();
  }
}
