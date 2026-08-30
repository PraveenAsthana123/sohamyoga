import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { saveClientCredentials } from '@/domain/reputation/reputationCredentialOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — status only, never returns secret values or vault references.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const row = await query<{
    auth_status: string; has_client: boolean; location_display_name: string | null;
    last_synced_at: string | null; last_failure_message: string | null;
  }>(
    `SELECT auth_status::text, (client_id_reference IS NOT NULL) AS has_client,
            location_display_name, last_synced_at, last_failure_message
     FROM google_business_connection WHERE tenant_id = $1`,
    [tenantId],
  );
  if (!row.rows.length) {
    return Response.json({ authStatus: 'not_configured', hasClientCredentials: false, locationDisplayName: null, lastSyncedAt: null, lastFailureMessage: null });
  }
  const r = row.rows[0];
  return Response.json({
    authStatus: r.auth_status, hasClientCredentials: r.has_client,
    locationDisplayName: r.location_display_name, lastSyncedAt: r.last_synced_at, lastFailureMessage: r.last_failure_message,
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { clientId?: string; clientSecret?: string } | null;
  if (!body?.clientId || !body.clientSecret) {
    return Response.json({ error: 'clientId and clientSecret are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  await saveClientCredentials(tenantId, body.clientId, body.clientSecret);
  return Response.json({ ok: true });
}
