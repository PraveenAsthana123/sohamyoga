import { NextRequest } from 'next/server';
import { streamOllamaChat, type ChatMessage, ollamaHealth } from '@/lib/ollama';

// Node runtime: streams from the local Ollama daemon over the network.
// This filesystem route takes precedence over the next.config.js /api/*
// rewrite (array-form rewrites run *after* filesystem routes), so /api/ai/*
// stays with Next.js while every other /api/* is proxied to the .NET backend.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Grounds the assistant in SohamYoga so answers stay on-brand and useful.
const SYSTEM_PROMPT = `You are the AI assistant for SohamYoga — a premium yoga and wellness platform.
Tagline: "Find Your Inner Peace."

SohamYoga offers:
- Live and on-demand yoga classes (Hatha, Vinyasa, Yin, Ashtanga, and more)
- AI-powered pose detection and real-time correction feedback
- Personalised AI yoga coaching and flow generation
- Flexible membership plans (Free, Monthly $49, Annual $399)
- Online booking with favourite teachers
- Community, challenges, and progress tracking

Guidelines:
- Be warm, encouraging, and wellness-focused. Short, friendly paragraphs.
- Help visitors discover the right class, teacher, or membership plan for their goals.
- For custom plans or corporate wellness, invite them to book a consultation.
- Never fabricate prices beyond the listed tiers or invent guarantees.
- Gently steer off-topic questions back to yoga, wellness, or the platform.`;

const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;

interface ChatBody {
  messages?: Array<{ role: string; content: string }>;
  model?: string;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const requestedModel = typeof body.model === 'string' ? body.model.trim() : '';
  const cleaned: ChatMessage[] = incoming
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.slice(0, MAX_CHARS),
    }));

  if (cleaned.length === 0) {
    return Response.json({ error: 'No messages provided' }, { status: 400 });
  }

  const health = await ollamaHealth(requestedModel || undefined);
  if (!health.ok) {
    return Response.json(
      {
        error: 'The selected local AI model is currently unavailable.',
        details: health.error || 'Ollama may be offline or the selected model is not installed.',
      },
      { status: 503 },
    );
  }

  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...cleaned];

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      // Server-Sent Events: each token as `data: {"delta": "..."}`, then [DONE].
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const delta of streamOllamaChat(messages, { signal: abort.signal, model: requestedModel || undefined })) {
          send({ delta });
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'stream error';
        send({ error: msg });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
