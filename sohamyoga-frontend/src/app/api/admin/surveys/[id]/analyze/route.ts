import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await Promise.resolve(params);

  // Gather all text responses for this survey
  const textAnswers = await query(
    `SELECT a.answer_text, q.question_text
     FROM survey_answer a
     JOIN survey_question q ON q.id = a.question_id
     JOIN survey_response r ON r.id = a.response_id
     WHERE r.survey_id = $1 AND a.answer_text IS NOT NULL AND LENGTH(TRIM(a.answer_text)) > 0
     LIMIT 100`,
    [id]
  );

  if (textAnswers.rows.length === 0) {
    return Response.json({ analysis: 'No text responses to analyze yet.', themes: [], sentiment: null });
  }

  const combinedText = (textAnswers.rows as Array<{ question_text: string; answer_text: string }>)
    .map(r => `Q: ${r.question_text}\nA: ${r.answer_text}`)
    .join('\n\n');

  const prompt = `You are analyzing survey responses for a business. Here are the responses:\n\n${combinedText}\n\nProvide:\n1. A 2-3 sentence summary of overall feedback\n2. Top 3-5 themes (as a bullet list)\n3. Sentiment: positive/neutral/negative percentages\n4. Two recommended actions\n\nBe concise and specific.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(60000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const data = await ollamaRes.json() as { response?: string };
    return Response.json({
      analysis: data.response ?? 'No analysis returned.',
      responseCount: textAnswers.rows.length,
      themes: [],
      sentiment: null,
    });
  } catch {
    return Response.json({
      analysis: `Analysis unavailable — Ollama not responding. ${textAnswers.rows.length} text responses collected.`,
      responseCount: textAnswers.rows.length,
      themes: [],
      sentiment: null,
    });
  }
}
