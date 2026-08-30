import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { startOAuth } from '@/domain/reputation/reputationCredentialOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — redirects to the real Google consent screen. Fails closed with a
// clear message (not a broken redirect) if client credentials aren't saved.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  try {
    const authUrl = await startOAuth(tenantId, `${req.nextUrl.origin}/api/admin/reputation/oauth/callback`);
    const url = new URL(authUrl);
    url.searchParams.set('state', JSON.stringify({ tenantId }));
    return Response.redirect(url.toString(), 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 422 });
  }
}
