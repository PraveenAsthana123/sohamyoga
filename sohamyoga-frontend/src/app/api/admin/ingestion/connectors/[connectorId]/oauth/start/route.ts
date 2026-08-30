import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { startOAuth, startSlackOAuth } from '@/domain/ingestion/connectorCredentialOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — redirects to the real consent screen for this connector's provider
// (Google or Slack). Fails closed with a clear message (not a broken
// redirect) if client credentials haven't been saved yet.
export async function GET(req: NextRequest, { params }: { params: { connectorId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) return Response.json({ error: 'tenantId is required.' }, { status: 400 });

  const connectorResult = await query<{ connector_key: string }>(`SELECT connector_key FROM connector WHERE id = $1`, [params.connectorId]);
  if (!connectorResult.rows.length) return Response.json({ error: 'Connector not found.' }, { status: 404 });
  const connectorKey = connectorResult.rows[0].connector_key;

  try {
    let authUrl: string;
    if (connectorKey === 'slack') {
      authUrl = await startSlackOAuth(tenantId, params.connectorId, `${req.nextUrl.origin}/api/admin/ingestion/oauth/slack/callback`);
    } else {
      authUrl = await startOAuth(tenantId, params.connectorId, `${req.nextUrl.origin}/api/admin/ingestion/oauth/google/callback`);
    }
    // Carry tenantId + connectorId through the provider's round trip via `state`.
    const url = new URL(authUrl);
    url.searchParams.set('state', JSON.stringify({ tenantId, connectorId: params.connectorId }));
    return Response.redirect(url.toString(), 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 422 });
  }
}
