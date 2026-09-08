import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real utm_link CRUD (src/domain/marketing/db-schema.sql). Prior audit
 * (2026-09-01, verified_by claude-session-2026-09-01, module_registry
 * module_key='utm-tracking') found the table had a real schema -- and a
 * real reader (src/app/api/analytics/attribution/route.ts, plus
 * AnalyticsAggregationJob summing click_count) -- but 0 rows and no admin
 * UI: nothing had ever written a link. This is the first real write
 * surface for it.
 *
 * GET  lists links with a real LEFT JOIN aggregation of campaign_lead rows
 *      attributed to each link (utm_link_id FK) -- leads captured and how
 *      many converted -- plus lookup data (campaign briefs, landing pages)
 *      the admin form needs. No click-through/impression metric is
 *      fabricated: click_count comes straight from the column that the new
 *      /utm/[id] redirect (see that route) actually increments.
 * POST creates a new UTM-tagged link. base_url must be a portal-owned
 *      relative path (either picked from an existing published landing
 *      page or typed directly) -- never a third-party URL, matching the
 *      safetyNote already declared on the `build_utm_link` MCP tool
 *      (src/domain/mcp/campaign-mcp-registry.ts), which has a tool
 *      definition but, until now, no real backing implementation anywhere
 *      in the codebase (grep-verified: no INSERT INTO utm_link existed
 *      before this route). Never seeds fake "already clicked" rows.
 */
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();

  const [links, briefs, landingPages] = await Promise.all([
    query<{
      id: string; brief_id: string | null; brief_name: string | null;
      base_url: string; utm_source: string; utm_medium: string; utm_campaign: string;
      utm_content: string | null; utm_term: string | null; full_url: string; click_count: number; bot_click_count: number;
      created_by: string; created_at: string;
      leads_count: string; converted_count: string;
    }>(
      `SELECT u.id, u.brief_id, cb.name AS brief_name, u.base_url, u.utm_source, u.utm_medium,
              u.utm_campaign, u.utm_content, u.utm_term, u.full_url, u.click_count, u.bot_click_count, u.created_by, u.created_at,
              COUNT(cl.id) AS leads_count,
              COUNT(cl.id) FILTER (WHERE cl.converted_at IS NOT NULL) AS converted_count
       FROM utm_link u
       LEFT JOIN campaign_brief cb ON cb.id = u.brief_id
       LEFT JOIN campaign_lead cl ON cl.utm_link_id = u.id
       WHERE u.tenant_id = $1
       GROUP BY u.id, cb.name
       ORDER BY u.created_at DESC`,
      [tenantId],
    ),
    query<{ id: string; name: string }>(
      `SELECT id, name FROM campaign_brief WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId],
    ),
    query<{ id: string; slug: string; title: string }>(
      `SELECT id, slug, title FROM landing_page WHERE tenant_id = $1 ORDER BY title ASC`,
      [tenantId],
    ),
  ]);

  return Response.json({
    links: links.rows.map(l => ({
      id: l.id, briefId: l.brief_id, briefName: l.brief_name,
      baseUrl: l.base_url, utmSource: l.utm_source, utmMedium: l.utm_medium, utmCampaign: l.utm_campaign,
      utmContent: l.utm_content, utmTerm: l.utm_term, fullUrl: l.full_url,
      trackingUrl: `/utm/${l.id}`, clickCount: l.click_count, botClickCount: l.bot_click_count,
      leadsCount: Number(l.leads_count), convertedCount: Number(l.converted_count),
      createdBy: l.created_by, createdAt: l.created_at,
    })),
    briefs: briefs.rows,
    landingPages: landingPages.rows.map(p => ({ id: p.id, slug: p.slug, title: p.title, url: `/lp/${p.slug}` })),
  });
}

const UTM_PART_RE = /^[a-zA-Z0-9._-]+$/;

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    baseUrl?: string; landingPageId?: string; briefId?: string | null;
    utmSource?: string; utmMedium?: string; utmCampaign?: string;
    utmContent?: string | null; utmTerm?: string | null;
  } | null;

  const utmSource = body?.utmSource?.trim();
  const utmMedium = body?.utmMedium?.trim();
  const utmCampaign = body?.utmCampaign?.trim();
  if (!utmSource || !utmMedium || !utmCampaign) {
    return Response.json({ error: 'utmSource, utmMedium, and utmCampaign are required.' }, { status: 400 });
  }
  for (const [label, value] of [['utmSource', utmSource], ['utmMedium', utmMedium], ['utmCampaign', utmCampaign]] as const) {
    if (!UTM_PART_RE.test(value)) {
      return Response.json({ error: `${label} may only contain letters, numbers, '.', '_', and '-'.` }, { status: 400 });
    }
  }
  const utmContent = body?.utmContent?.trim() || null;
  const utmTerm = body?.utmTerm?.trim() || null;

  const tenantId = await getPrimaryTenantId();

  // Resolve the destination: either an existing published landing page (looked
  // up server-side, never trusting a client-supplied URL for it) or a raw
  // path the admin typed. Either way it must be a portal-owned relative path
  // -- this deliberately can never build a tracking link to a third-party
  // site, per the safety note already declared on the MCP build_utm_link tool.
  let baseUrl: string;
  if (body?.landingPageId) {
    const page = await query<{ slug: string }>(
      `SELECT slug FROM landing_page WHERE id = $1 AND tenant_id = $2`,
      [body.landingPageId, tenantId],
    );
    if (!page.rowCount) return Response.json({ error: 'Selected landing page was not found.' }, { status: 404 });
    baseUrl = `/lp/${page.rows[0].slug}`;
  } else {
    const raw = body?.baseUrl?.trim();
    if (!raw) return Response.json({ error: 'Provide either landingPageId or baseUrl.' }, { status: 400 });
    if (!raw.startsWith('/') || raw.startsWith('//')) {
      return Response.json({ error: 'baseUrl must be a portal-owned relative path starting with "/" (e.g. /lp/spring-retreat) -- external URLs are not allowed.' }, { status: 400 });
    }
    baseUrl = raw;
  }

  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  if (utmContent) params.set('utm_content', utmContent);
  if (utmTerm) params.set('utm_term', utmTerm);
  const [path, existingQuery] = baseUrl.split('?');
  const merged = existingQuery ? `${existingQuery}&${params.toString()}` : params.toString();
  const fullUrl = `${path}?${merged}`;

  const result = await query<{ id: string }>(
    `INSERT INTO utm_link (tenant_id, brief_id, base_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, full_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [tenantId, body?.briefId || null, baseUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, fullUrl, principal?.email ?? 'admin'],
  );

  return Response.json({ ok: true, id: result.rows[0].id, fullUrl, trackingUrl: `/utm/${result.rows[0].id}` }, { status: 201 });
}
