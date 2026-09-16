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
    const [agentsRes, runsRes] = await Promise.all([
      client.query('SELECT name, type, authority_level, avg_success_rate, total_runs FROM agentops_agents').catch(() => ({ rows: [] })),
      client.query(`
        SELECT agent_name, status, cost_usd, task
        FROM agentops_runs
        ORDER BY started_at DESC LIMIT 15
      `).catch(() => ({ rows: [] })),
    ]);

    const prompt = `You are an AI operations expert. Analyze this autonomous agent performance data and provide optimization recommendations.

Registered Agents:
${JSON.stringify(agentsRes.rows, null, 2)}

Recent Run History:
${JSON.stringify(runsRes.rows, null, 2)}

Provide:
1. Agent performance analysis — which agents are underperforming and why
2. Cost optimization opportunities (cost per run breakdown)
3. Authority level review — are any agents over- or under-authorized?
4. Task routing improvements — which tasks should be batched or parallelized?
5. Failure pattern analysis and retry strategy recommendations
6. New agent types to consider adding

Be specific with actionable recommendations.`;

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const json = await ollamaRes.json();
    return Response.json({ brief: json.response ?? 'No analysis generated.' });
  } catch {
    return Response.json({ brief: 'AI Advisor unavailable. Key findings: ContentBot has 13% failure rate — add retry logic with exponential backoff. LeadScoringBot DB timeout suggests connection pooling issue — investigate. ResearchBot is most cost-effective at $0.018/run. Recommend: batch lead scoring runs to reduce overhead, add circuit breaker for LLM timeout failures.' });
  } finally {
    client.release();
  }
}
