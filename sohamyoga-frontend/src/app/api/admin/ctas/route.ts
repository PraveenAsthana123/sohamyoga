import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['draft', 'active', 'paused', 'archived'];
const VALID_TYPES = ['form', 'booking', 'call', 'whatsapp', 'link', 'download', 'subscribe', 'share', 'custom'];
const VALID_PLACEMENTS = ['hero', 'footer', 'sidebar', 'inline', 'sticky', 'popup', 'email', 'other'];
const VALID_RISKS = ['low', 'medium', 'high'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const statusFilter = req.nextUrl.searchParams.get('status');

  const params: unknown[] = [tenantId];
  let whereExtra = '';
  if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
    params.push(statusFilter);
    whereExtra = ` AND c.status = $${params.length}`;
  }

  const [ctas, summary] = await Promise.all([
    query<{
      id: string; label: string; type: string; destination_url: string; tracking_slug: string;
      placement: string; risk_classification: string; status: string; click_count: number;
      last_check_status: string; fallback_url: string | null; created_at: string; updated_at: string;
      clicks_30d: string;
    }>(
      `SELECT c.id, c.label, c.type, c.destination_url, c.tracking_slug,
              c.placement, c.risk_classification, c.status, c.click_count,
              c.last_check_status, c.fallback_url, c.created_at, c.updated_at,
              count(ce.id) FILTER (WHERE ce.occurred_at >= now() - interval '30 days')::text AS clicks_30d
       FROM cta c
       LEFT JOIN cta_click_event ce ON ce.cta_id = c.id
       WHERE c.tenant_id = $1${whereExtra}
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      params,
    ),
    query<{
      total: string; active: string; clicks_30d: string;
      top_label: string | null; top_clicks: string | null;
    }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE status = 'active')::text AS active,
         (SELECT count(*) FROM cta_click_event ce2
          JOIN cta c2 ON c2.id = ce2.cta_id AND c2.tenant_id = $1
          WHERE ce2.occurred_at >= now() - interval '30 days')::text AS clicks_30d,
         (SELECT c3.label FROM cta c3
          WHERE c3.tenant_id = $1
          ORDER BY c3.click_count DESC LIMIT 1) AS top_label,
         (SELECT c4.click_count::text FROM cta c4
          WHERE c4.tenant_id = $1
          ORDER BY c4.click_count DESC LIMIT 1) AS top_clicks
       FROM cta WHERE tenant_id = $1`,
      [tenantId],
    ),
  ]);

  const s = summary.rows[0];
  return Response.json({
    ctas: ctas.rows,
    summary: {
      total: Number(s?.total ?? 0),
      active: Number(s?.active ?? 0),
      clicks30d: Number(s?.clicks_30d ?? 0),
      topPerformer: s?.top_label ? { label: s.top_label, clicks: Number(s.top_clicks ?? 0) } : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    label?: string; type?: string; destinationUrl?: string; trackingSlug?: string;
    placement?: string; riskClassification?: string; fallbackUrl?: string | null;
  } | null;

  if (!body?.label?.trim()) return Response.json({ error: 'label is required.' }, { status: 400 });
  if (!body.type || !VALID_TYPES.includes(body.type)) return Response.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  if (!body.destinationUrl?.trim()) return Response.json({ error: 'destinationUrl is required.' }, { status: 400 });
  if (!body.trackingSlug?.trim()) return Response.json({ error: 'trackingSlug is required.' }, { status: 400 });

  const placement = body.placement && VALID_PLACEMENTS.includes(body.placement) ? body.placement : 'other';
  const risk = body.riskClassification && VALID_RISKS.includes(body.riskClassification) ? body.riskClassification : 'low';
  const tenantId = await getPrimaryTenantId();

  const result = await query(
    `INSERT INTO cta (tenant_id, label, type, destination_url, tracking_slug, placement,
                      risk_classification, fallback_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, label, type, destination_url, tracking_slug, placement, risk_classification,
               status, click_count, last_check_status, fallback_url, created_at`,
    [
      tenantId, body.label.trim(), body.type, body.destinationUrl.trim(),
      body.trackingSlug.trim(), placement, risk,
      body.fallbackUrl ?? null, principal!.email ?? principal!.id,
    ],
  );
  return Response.json({ cta: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    id?: string; status?: string;
  } | null;

  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const result = await query(
    `UPDATE cta SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, label, status, updated_at`,
    [body.id, body.status],
  );
  if (!result.rowCount) return Response.json({ error: 'CTA not found.' }, { status: 404 });
  return Response.json({ cta: result.rows[0] });
}
