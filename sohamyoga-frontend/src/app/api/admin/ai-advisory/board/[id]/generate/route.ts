export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM board_briefings WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    const b = rows[0];

    const prompt = `You are an executive AI communications specialist. Write a professional board briefing narrative for:

Title: ${b.title}
Audience: ${b.audience}
Key Messages: ${(b.key_messages ?? []).join('; ')}
Risk Items: ${(b.risk_items ?? []).join('; ')}
Investment Ask: $${b.investment_ask}

Write a concise executive briefing (300 words max) with:
1. Executive Summary (2-3 sentences)
2. Strategic Context (1 paragraph)
3. Key Achievements & Metrics (3-4 bullets)
4. Risk Assessment (2-3 bullets)
5. Investment Recommendation & Next Steps

Use formal board-level language. Be specific with numbers and business impact.`;

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await ollamaRes.json();
      return Response.json({ title: b.title, narrative: data.response ?? 'No response from Ollama' });
    } catch {
      return Response.json({
        title: b.title,
        narrative: `EXECUTIVE BRIEFING: ${b.title}\nAudience: ${b.audience}\n\nKey Messages:\n${(b.key_messages ?? []).map((m: string) => `• ${m}`).join('\n')}\n\nRisks:\n${(b.risk_items ?? []).map((r: string) => `• ${r}`).join('\n')}\n\nInvestment Ask: $${b.investment_ask}\n\n[Ollama unavailable — static template]`,
      });
    }
  } finally {
    client.release();
  }
}
