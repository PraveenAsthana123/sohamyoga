import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { registerChatGptSource } from '@/domain/ingestion/chatGptSourceOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/ingestion/sources/register — the Manual Process form action:
// register a chatgpt.com/share/ link as a source and run its first discovery.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { shareUrl?: string } | null;
  const shareUrl = body?.shareUrl?.trim();
  if (!shareUrl) return Response.json({ error: 'shareUrl is required.' }, { status: 400 });
  if (!/^https:\/\/chatgpt\.com\/share\//.test(shareUrl)) {
    return Response.json({ error: 'shareUrl must be a https://chatgpt.com/share/... link.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();

  try {
    const result = await registerChatGptSource(tenantId, shareUrl);
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 422 });
  }
}
