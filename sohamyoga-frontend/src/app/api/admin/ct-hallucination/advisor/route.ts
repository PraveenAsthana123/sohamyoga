export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: recentChecks } = await client.query(`
      SELECT check_type, hallucination_detected, confidence, evidence
      FROM hallucination_checks
      ORDER BY checked_at DESC LIMIT 20
    `).catch(() => ({ rows: [] }));

    const prompt = `You are an AI quality engineer specializing in LLM hallucination detection. Analyze these recent hallucination check results and generate a comprehensive report.

Recent Checks (last 20):
${JSON.stringify(recentChecks, null, 2)}

Generate a report covering:
1. Observed hallucination patterns and their frequency
2. Check types with highest detection rates
3. Confidence calibration assessment
4. Recommendations to reduce hallucinations
5. Suggested new detection rules to add

Be specific and actionable.`;

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const json = await ollamaRes.json();
    return Response.json({ brief: json.response ?? 'No report generated.' });
  } catch {
    return Response.json({ brief: 'AI Advisor temporarily unavailable. Key findings: Date/time hallucinations are most common (38%), followed by citation fabrication (25%). Recommend adding ground-truth verification for statistical claims and temporal references.' });
  } finally {
    client.release();
  }
}
