import { NextRequest } from 'next/server';
import { ollamaHealth } from '@/lib/ollama';

// Lightweight readiness probe for the local AI backend. Lets the admin UI or a
// monitor confirm the Ollama daemon is reachable and the configured chat model
// is installed, without exposing the daemon URL to the browser.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedModel = searchParams.get('model')?.trim() || '';
  const health = await ollamaHealth(requestedModel || undefined);
  return Response.json(
    {
      ok: health.ok,
      model: health.model,
      modelInstalled: health.ok,
      installedCount: health.models.length,
      error: health.error,
    },
    { status: health.ok ? 200 : 503 },
  );
}
