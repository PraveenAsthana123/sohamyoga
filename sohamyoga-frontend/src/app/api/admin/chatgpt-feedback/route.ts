import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { askChatGptForFeedback } from '@/lib/chatgptFeedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/chatgpt-feedback — send a query to ChatGPT (via the real
// OpenAI API) and return its response. Fails closed with a clear message if
// no API key has been saved yet.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { query?: string } | null;
  if (!body?.query?.trim()) return Response.json({ error: 'query is required.' }, { status: 400 });

  const result = await askChatGptForFeedback(body.query);
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ ok: true, response: result.response });
}
