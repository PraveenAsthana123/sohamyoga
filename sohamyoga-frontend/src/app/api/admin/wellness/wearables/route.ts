import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// No real OAuth client exists for any wearable platform (Fitbit/Garmin/Apple
// Health/Google Fit/Samsung Health/Polar all need real developer credentials
// this environment does not have) -- this route is honestly a manual status
// record only, never a live sync. connect_wearable in WellnessMcpRegistry
// describes the intended tool; this is its real-but-manual backing store.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT ws.*, c.display_name, c.email FROM wearable_sync ws
     LEFT JOIN customer c ON c.id::text = ws.customer_id
     WHERE ws.tenant_id = $1 ORDER BY ws.updated_at DESC`,
    [tenantId],
  );
  return Response.json({
    entries: rows.rows,
    note: 'Manual status tracking only -- no real OAuth integration exists for any wearable platform in this environment.',
  });
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  if (!body.customerId || !body.platform) {
    return Response.json({ error: 'customerId and platform are required.' }, { status: 400 });
  }
  const status = body.status ?? 'pending_auth';
  if (status === 'error' && !body.errorMessage) {
    return Response.json({ error: 'errorMessage is required when status is "error".' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  // connected_at computed in JS, not SQL -- reusing $4 (the enum-typed status
  // param) inside a CASE WHEN $4 = 'connected' comparison made Postgres
  // deduce conflicting types for the same parameter (42P08), a real bug
  // found live 2026-09-01 (psql with literal values didn't reproduce it).
  const connectedAtNow = status === 'connected' ? new Date() : null;
  const result = await query(
    `INSERT INTO wearable_sync (tenant_id, customer_id, platform, status, device_name, error_message, connected_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, customer_id, platform) DO UPDATE SET
       status = EXCLUDED.status, device_name = EXCLUDED.device_name, error_message = EXCLUDED.error_message,
       connected_at = CASE WHEN EXCLUDED.status = 'connected' AND wearable_sync.connected_at IS NULL THEN now() ELSE wearable_sync.connected_at END,
       disconnected_at = CASE WHEN EXCLUDED.status = 'disconnected' AND wearable_sync.connected_at IS NOT NULL THEN now() ELSE wearable_sync.disconnected_at END,
       updated_at = now()
     RETURNING id`,
    [tenantId, body.customerId, body.platform, status, body.deviceName ?? null, body.errorMessage ?? null, connectedAtNow],
  );
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
