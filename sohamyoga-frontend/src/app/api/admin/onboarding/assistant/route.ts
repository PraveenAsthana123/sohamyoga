import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { streamOllamaChat, ollamaHealth, type ChatMessage } from '@/lib/ollama';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { computeBusinessReadiness } from '@/domain/onboarding/BusinessReadinessScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real AI Onboarding Assistant -- reuses the same real streamOllamaChat
// infra as /api/ai/chat (the customer-facing assistant), but grounds the
// system prompt in this tenant's ACTUAL Business Readiness Score checks
// (built earlier this round) so answers reference real setup gaps, not
// generic advice with fabricated specifics.
const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { messages?: Array<{ role: string; content: string }> } | null;
  const incoming = Array.isArray(body?.messages) ? body!.messages : [];
  const cleaned: ChatMessage[] = incoming
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, MAX_CHARS) }));
  if (cleaned.length === 0) return Response.json({ error: 'No messages provided.' }, { status: 400 });

  const health = await ollamaHealth();
  if (!health.ok) {
    return Response.json({ error: 'The local AI model is currently unavailable.', details: health.error }, { status: 503 });
  }

  const tenantId = await getPrimaryTenantId();
  const [profile, brandKit, branches, products, channels, tenant] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM marketing_business_profile WHERE tenant_id = $1`, [tenantId]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM brand_kit WHERE tenant_id = $1 AND is_default = true`, [tenantId]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM branch WHERE tenant_id = $1`, [tenantId]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM product_master WHERE status != 'archived'`, []),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM tenant_channel_config WHERE tenant_id = $1 AND enabled = true`, [tenantId]),
    query<{ owner_user_id: string | null }>(`SELECT owner_user_id FROM tenant WHERE id = $1`, [tenantId]),
  ]);
  const readiness = computeBusinessReadiness({
    hasBusinessProfile: Number(profile.rows[0]?.count ?? 0) > 0,
    hasBrandKit: Number(brandKit.rows[0]?.count ?? 0) > 0,
    branchCount: Number(branches.rows[0]?.count ?? 0),
    productCount: Number(products.rows[0]?.count ?? 0),
    connectedChannelCount: Number(channels.rows[0]?.count ?? 0),
    hasOwner: Boolean(tenant.rows[0]?.owner_user_id),
  });

  const systemPrompt = `You are the setup assistant for a new business onboarding onto this platform.
Real current readiness score: ${readiness.score}/100 (${readiness.trafficLight}).
Real setup status per area:
${readiness.checks.map(c => `- ${c.label}: ${c.status} -- ${c.detail}`).join('\n')}

Guidelines:
- Ground every answer in the real status above. Never invent a status not listed.
- Prioritize the failing/warning items first, in the order they most likely block launch.
- Be concise and actionable -- name the exact admin screen to visit when relevant (e.g. /admin/brand-kits, /admin/marketing-command).
- Never claim a step is complete if its real status above says otherwise.`;

  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...cleaned];

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const delta of streamOllamaChat(messages, { signal: abort.signal })) {
          send({ delta });
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        send({ error: e instanceof Error ? e.message : 'stream error' });
      } finally {
        controller.close();
      }
    },
    cancel() { abort.abort(); },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
