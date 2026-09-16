export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

/**
 * POST /api/ai/generate
 * Thin proxy to Ollama /api/generate for ad-copy, keyword suggestions,
 * calendar event descriptions, and any other admin AI text generation.
 *
 * Body: { model?: string; prompt: string; stream?: false }
 * Returns: { text: string } on success, { error: string } on failure.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: { model?: unknown; prompt?: unknown; stream?: unknown };
  try {
    body = await req.json() as { model?: unknown; prompt?: unknown; stream?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return Response.json({ error: 'A non-empty "prompt" field is required' }, { status: 400 });
  }

  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => 'unknown error');
      return Response.json(
        { error: `Ollama returned ${ollamaRes.status}: ${errText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await ollamaRes.json() as { response?: string; error?: string };
    if (data.error) {
      return Response.json({ error: data.error }, { status: 502 });
    }

    return Response.json({ text: data.response ?? '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Distinguish timeout vs connection refused
    if (message.includes('AbortError') || message.includes('timed out')) {
      return Response.json({ error: 'Ollama request timed out (60s limit)' }, { status: 504 });
    }
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return Response.json(
        { error: 'Ollama is not running. Start it with: ollama serve' },
        { status: 503 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
