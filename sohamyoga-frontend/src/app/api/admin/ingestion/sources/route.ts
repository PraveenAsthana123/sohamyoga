import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query<{
    id: string; name: string; external_id: string; source_type: string; discovery_status: string;
    connector_key: string; created_at: string; last_discovered_at: string | null; last_verified_at: string | null;
    version_count: string; latest_version_label: string | null;
  }>(
    `SELECT s.id, s.name, s.external_id, s.source_type, s.discovery_status::text,
            c.connector_key, s.created_at, s.last_discovered_at, s.last_verified_at,
            COUNT(sv.id) AS version_count,
            (SELECT version_label FROM source_version WHERE source_id = s.id ORDER BY recorded_at DESC LIMIT 1) AS latest_version_label
     FROM source s
     JOIN connector c ON c.id = s.connector_id
     LEFT JOIN source_version sv ON sv.source_id = s.id
     WHERE s.tenant_id = $1
     GROUP BY s.id, c.connector_key
     ORDER BY s.created_at DESC`,
    [tenantId],
  );

  return Response.json({
    sources: rows.rows.map(s => ({
      id: s.id, name: s.name, externalId: s.external_id, sourceType: s.source_type,
      discoveryStatus: s.discovery_status, connectorKey: s.connector_key,
      createdAt: s.created_at, lastDiscoveredAt: s.last_discovered_at, lastVerifiedAt: s.last_verified_at,
      versionCount: Number(s.version_count), latestVersionLabel: s.latest_version_label,
    })),
  });
}
