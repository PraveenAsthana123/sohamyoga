import { NextRequest } from 'next/server';
import { listOllamaModels, OLLAMA_MODEL } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const models = await listOllamaModels();
  const sorted = [...new Set(models)].sort();
  const defaultModel = sorted.includes(OLLAMA_MODEL) ? OLLAMA_MODEL : sorted[0] || OLLAMA_MODEL;

  return Response.json({
    models: sorted,
    defaultModel,
  });
}
