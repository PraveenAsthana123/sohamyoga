import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/journey?contact=email@x.com — a real, per-contact chronological
// touchpoint timeline. This is the honest version of "conversion-path
// visualization": an individual real timeline, not a fabricated aggregate
// Sankey diagram with no real volume behind it.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const contact = req.nextUrl.searchParams.get('contact')?.trim();
  if (!contact) return Response.json({ error: 'contact query parameter is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, contact_identifier, touchpoint_type::text, source_module, occurred_at, metadata
     FROM journey_touchpoint WHERE tenant_id = $1 AND contact_identifier = $2 ORDER BY occurred_at ASC`,
    [tenantId, contact],
  );
  return Response.json({ contact, touchpoints: rows.rows });
}
