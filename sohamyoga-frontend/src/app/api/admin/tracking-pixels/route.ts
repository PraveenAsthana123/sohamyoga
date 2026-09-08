import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ platform: string; pixel_id: string | null; enabled: boolean; updated_at: string }>(
    `SELECT platform, pixel_id, enabled, updated_at FROM tracking_pixel_config WHERE tenant_id = $1`,
    [tenantId],
  );
  return Response.json({ config: result.rows });
}

// Real save -- upserts one platform's pixel_id/enabled at a time. Does not
// touch the other platform's row (a PUT for meta_pixel never clears ga4).
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { platform?: string; pixelId?: string; enabled?: boolean } | null;
  if (body?.platform !== 'meta_pixel' && body?.platform !== 'ga4' && body?.platform !== 'posthog') {
    return Response.json({ error: 'platform must be "meta_pixel", "ga4", or "posthog".' }, { status: 400 });
  }

  const { principal } = await getAdminPrincipal(req);
  const tenantId = await getPrimaryTenantId();
  const pixelId = body.pixelId?.trim() || null;
  const enabled = Boolean(body.enabled) && Boolean(pixelId);

  const result = await query<{ platform: string; pixel_id: string | null; enabled: boolean; updated_at: string }>(
    `INSERT INTO tracking_pixel_config (tenant_id, platform, pixel_id, enabled, updated_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, platform) DO UPDATE SET
       pixel_id = EXCLUDED.pixel_id, enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING platform, pixel_id, enabled, updated_at`,
    [tenantId, body.platform, pixelId, enabled, principal?.email ?? principal?.id ?? 'unknown'],
  );
  return Response.json({ config: result.rows[0] });
}
