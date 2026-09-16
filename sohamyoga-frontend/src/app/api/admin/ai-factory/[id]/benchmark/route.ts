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
    const { rows } = await client.query(`SELECT * FROM ai_factory_models WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    const model = rows[0];

    const prompt = `You are an AI benchmarking expert. Generate realistic mock benchmark metrics for this model:

Model: ${model.name}
Provider: ${model.provider}
Type: ${model.type}
Tags: ${(model.tags ?? []).join(', ')}

Return JSON with realistic metrics:
{
  "latency_p50_ms": number,
  "latency_p95_ms": number,
  "throughput_tokens_per_sec": number,
  "quality_score": 0-100,
  "context_window": number,
  "cost_per_1k_tokens_usd": number (0 if local/free),
  "strengths": ["list of 2 strengths"],
  "limitations": ["list of 2 limitations"]
}`;

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await ollamaRes.json();
      const text = data.response ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      const benchmark = match ? JSON.parse(match[0]) : null;
      if (benchmark?.quality_score) {
        await client.query(`UPDATE ai_factory_models SET performance_score=$1 WHERE id=$2`, [benchmark.quality_score, params.id]);
      }
      return Response.json({ model_name: model.name, benchmark, raw: text });
    } catch {
      // Static fallback mock metrics
      const isLocal = model.provider === 'Ollama';
      return Response.json({
        model_name: model.name,
        benchmark: {
          latency_p50_ms: isLocal ? 450 : 280,
          latency_p95_ms: isLocal ? 1200 : 650,
          throughput_tokens_per_sec: isLocal ? 45 : 120,
          quality_score: Number(model.performance_score) || 80,
          context_window: isLocal ? 8192 : 128000,
          cost_per_1k_tokens_usd: isLocal ? 0 : 0.015,
          strengths: ['No data egress', 'Zero API cost'],
          limitations: ['Slower on CPU', 'Smaller context window'],
        },
        raw: 'Ollama unavailable — static fallback',
      });
    }
  } finally {
    client.release();
  }
}
