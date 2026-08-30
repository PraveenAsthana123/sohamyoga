import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureDefaultConnectors, getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  await ensureDefaultConnectors(tenantId);

  const rows = await query<{
    id: string; connector_key: string; source_family: string; auth_type: string; status: string;
    can_discover: boolean; can_read: boolean; can_write: boolean; can_webhook: boolean; can_incremental_sync: boolean;
    last_successful_discovery_at: string | null; source_count: string;
  }>(
    `SELECT c.id, c.connector_key, c.source_family, c.auth_type, c.status::text,
            c.can_discover, c.can_read, c.can_write, c.can_webhook, c.can_incremental_sync,
            c.last_successful_discovery_at,
            COUNT(s.id) AS source_count
     FROM connector c LEFT JOIN source s ON s.connector_id = c.id
     WHERE c.tenant_id = $1
     GROUP BY c.id ORDER BY c.can_discover DESC, c.connector_key`,
    [tenantId],
  );

  return Response.json({
    tenantId,
    connectors: rows.rows.map(c => ({
      id: c.id, connectorKey: c.connector_key, sourceFamily: c.source_family,
      authType: c.auth_type, status: c.status,
      capabilities: {
        discover: c.can_discover, read: c.can_read, write: c.can_write,
        webhook: c.can_webhook, incrementalSync: c.can_incremental_sync,
      },
      lastSuccessfulDiscoveryAt: c.last_successful_discovery_at,
      sourceCount: Number(c.source_count),
    })),
  });
}
