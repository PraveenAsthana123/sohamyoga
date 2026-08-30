import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { scanWatchedFolder } from '@/domain/ingestion/localFolderOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — the Manual Process tab's "Scan now" button; same op LocalFolderScanJob runs on schedule.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await scanWatchedFolder(tenantId);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 422 });
  }
}
