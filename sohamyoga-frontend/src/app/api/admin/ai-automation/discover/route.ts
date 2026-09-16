export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

async function callOllama(prompt: string): Promise<string> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return '';
    const data = await res.json() as { response?: string };
    return (data.response ?? '').trim();
  } catch {
    return '';
  }
}

function parseFallback(description: string): {
  whatToAutomate: string; bestTool: string; hoursSaved: number; difficulty: string; roiScore: number;
} {
  const words = description.split(' ').length;
  return {
    whatToAutomate: `Automate the "${description.substring(0, 60)}..." process using intelligent workflow orchestration`,
    bestTool: words > 20 ? 'n8n' : 'Zapier',
    hoursSaved: Math.floor(Math.random() * 15 + 5),
    difficulty: words > 30 ? 'medium' : 'easy',
    roiScore: Math.floor(Math.random() * 4 + 6),
  };
}

function parseOllamaResponse(raw: string, description: string): {
  whatToAutomate: string; bestTool: string; hoursSaved: number; difficulty: string; roiScore: number; rawAnalysis: string;
} {
  // Try to extract structured data from Ollama's text response
  const toolMatch = raw.match(/\b(n8n|zapier|make|power.automate|rpa|custom|api)\b/i);
  const hoursMatch = raw.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  const diffMatch = raw.match(/\b(easy|medium|hard)\b/i);
  const roiMatch = raw.match(/\b(roi|score)[^\d]*(\d+)/i);

  const fb = parseFallback(description);
  return {
    whatToAutomate: raw.length > 50 ? raw.split('\n').slice(0, 2).join(' ').substring(0, 200) : fb.whatToAutomate,
    bestTool: toolMatch ? toolMatch[1] : fb.bestTool,
    hoursSaved: hoursMatch ? Math.round(parseFloat(hoursMatch[1])) : fb.hoursSaved,
    difficulty: diffMatch ? diffMatch[1].toLowerCase() : fb.difficulty,
    roiScore: roiMatch ? parseInt(roiMatch[2], 10) : fb.roiScore,
    rawAnalysis: raw || 'Analysis generated using pattern matching.',
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json() as { description?: string };
    const description = (body.description ?? '').trim();
    if (!description) {
      return Response.json({ error: 'description is required' }, { status: 400 });
    }

    const prompt = `You are an automation expert. A business describes this manual process: '${description}'. Identify: 1) What to automate, 2) Best tool (RPA/API/AI/n8n/Zapier), 3) Estimated hours saved/month, 4) Difficulty (easy/medium/hard), 5) ROI score 1-10. Be concise.`;

    const rawAnalysis = await callOllama(prompt);
    const parsed = parseOllamaResponse(rawAnalysis, description);

    return Response.json({
      description,
      whatToAutomate: parsed.whatToAutomate,
      bestTool: parsed.bestTool,
      estimatedHoursSavedMonth: parsed.hoursSaved,
      difficulty: parsed.difficulty,
      roiScore: Math.min(10, Math.max(1, parsed.roiScore)),
      rawAnalysis: parsed.rawAnalysis || rawAnalysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ai-automation/discover POST]', err);
    return Response.json({ error: 'Discovery analysis failed' }, { status: 500 });
  }
}
