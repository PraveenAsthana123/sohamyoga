export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let callStats = {};
  if (databaseConfigured()) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT outcome, sentiment, COUNT(*)::int AS cnt, ROUND(AVG(duration_seconds)::numeric,0) AS avg_dur
        FROM voice_ai_calls
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY outcome, sentiment
        ORDER BY cnt DESC
      `);
      callStats = rows;
    } catch { /* ignore */ } finally {
      client.release();
    }
  }

  const body = await req.json().catch(() => ({}));
  const { health_score = 0, kpis = [] } = body;

  const prompt = `You are a voice AI platform manager. Analyze call patterns and provide script improvement suggestions.

Health Score: ${health_score}/100
KPIs: ${JSON.stringify(kpis)}
Call Pattern Data (last 7 days): ${JSON.stringify(callStats)}

Provide: 1) Call volume and quality assessment, 2) Sentiment pattern analysis, 3) Script improvements for low-performing intents, 4) Agent performance recommendations.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!ollamaRes.ok) throw new Error('Ollama error');
    const data = await ollamaRes.json();
    return Response.json({ brief: data.response, model: 'llama3.2', generated_at: new Date().toISOString() });
  } catch {
    return Response.json({
      brief: `Voice AI Health Assessment (Score: ${health_score}/100)\n\nCall center is ${health_score >= 70 ? 'performing well' : health_score >= 40 ? 'operational with room for improvement' : 'underperforming'}.\n\nScript Improvement Recommendations:\n1. Review escalated call transcripts to identify friction points\n2. Add more empathy phrases to the support script for negative-sentiment calls\n3. Shorten average call duration by adding structured options menus\n4. A/B test Aria's greeting to improve first-call resolution\n\nNote: AI advisor unavailable — fallback analysis shown.`,
      model: 'fallback',
      generated_at: new Date().toISOString(),
    });
  }
}
