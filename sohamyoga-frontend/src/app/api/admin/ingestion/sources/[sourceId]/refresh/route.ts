import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { refreshChatGptSource } from '@/domain/ingestion/chatGptSourceOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/ingestion/sources/:sourceId/refresh — the Automatic Process
// tab's manual "Re-check now" button; the same op IngestionSourceRefreshJob runs on schedule.
export async function POST(req: NextRequest, { params }: { params: { sourceId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const result = await refreshChatGptSource(params.sourceId);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 422 });
  }
}
