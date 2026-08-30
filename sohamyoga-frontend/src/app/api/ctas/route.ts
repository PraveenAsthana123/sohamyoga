import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { Cta, type CtaProps } from '@/domain/cta/Cta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, label, type, destination_url, tracking_slug, placement, risk_classification::text,
            status::text, click_count, last_checked_at, last_check_status::text, fallback_url, created_at
     FROM cta WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
  return Response.json({
    ctas: rows.rows.map(r => ({
      id: r.id, label: r.label, type: r.type, destinationUrl: r.destination_url, trackingSlug: r.tracking_slug,
      goUrl: `/go/${r.tracking_slug}`, placement: r.placement, risk: r.risk_classification, status: r.status,
      clickCount: r.click_count, lastCheckedAt: r.last_checked_at, lastCheckStatus: r.last_check_status,
      fallbackUrl: r.fallback_url, createdAt: r.created_at,
    })),
  });
}

// POST — creates a CTA and runs a REAL destination-health check before it can
// ever go live (Module 9's "destination validation before publish").
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    label?: string; type?: string; destinationUrl?: string; trackingSlug?: string; placement?: string; fallbackUrl?: string;
  } | null;
  if (!body?.label || !body.type || !body.destinationUrl || !body.trackingSlug) {
    return Response.json({ error: 'label, type, destinationUrl, and trackingSlug are required.' }, { status: 400 });
  }

  let cta: Cta;
  try {
    cta = new Cta({
      id: crypto.randomUUID(), label: body.label, type: body.type as CtaProps['type'],
      destinationUrl: body.destinationUrl, trackingSlug: body.trackingSlug,
      placement: (body.placement as CtaProps['placement']) ?? 'other', riskClassification: 'low',
      status: 'draft', clickCount: 0, lastCheckStatus: 'unknown', fallbackUrl: body.fallbackUrl,
      createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid CTA data.' }, { status: 400 });
  }

  // Real destination check via HEAD (fall back to GET — some servers reject HEAD).
  let checkStatus: CtaProps['lastCheckStatus'] = 'unknown';
  try {
    let res = await fetch(cta.destinationUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5_000) });
    if (!res.ok) res = await fetch(cta.destinationUrl, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5_000) });
    checkStatus = res.ok ? 'ok' : 'broken';
  } catch {
    checkStatus = 'broken';
  }
  cta = cta.recordCheck(checkStatus);

  const tenantId = await getPrimaryTenantId();
  const p = cta.toJSON();
  try {
    await query(
      `INSERT INTO cta (id, tenant_id, label, type, destination_url, tracking_slug, placement, risk_classification,
                         status, click_count, last_checked_at, last_check_status, fallback_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [p.id, tenantId, p.label, p.type, p.destinationUrl, p.trackingSlug, p.placement, p.riskClassification,
       p.status, p.clickCount, p.lastCheckedAt ?? null, p.lastCheckStatus, p.fallbackUrl ?? null, p.createdBy],
    );
    return Response.json({ ok: true, id: p.id, lastCheckStatus: p.lastCheckStatus }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A CTA with this tracking slug already exists.' : message }, { status });
  }
}
