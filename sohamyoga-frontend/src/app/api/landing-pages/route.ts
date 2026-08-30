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
  const rows = await query(
    `SELECT lp.id, lp.slug, lp.title, lp.headline, lp.status::text, lp.view_count, lp.version, lp.published_at, lp.created_at,
            c.label AS cta_label, c.tracking_slug AS cta_slug
     FROM landing_page lp LEFT JOIN cta c ON c.id = lp.cta_id
     WHERE lp.tenant_id = $1 ORDER BY lp.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    pages: rows.rows.map(r => ({
      id: r.id, slug: r.slug, title: r.title, headline: r.headline, status: r.status,
      viewCount: r.view_count, version: r.version, publishedAt: r.published_at, createdAt: r.created_at,
      url: `/lp/${r.slug}`, ctaLabel: r.cta_label, ctaGoUrl: r.cta_slug ? `/go/${r.cta_slug}` : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    slug?: string; title?: string; headline?: string; subheadline?: string; bodyMarkdown?: string;
    ctaId?: string; seoTitle?: string; seoDescription?: string;
  } | null;
  if (!body?.slug || !body.title || !body.headline) {
    return Response.json({ error: 'slug, title, and headline are required.' }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) return Response.json({ error: 'slug must be lowercase letters, numbers, and hyphens.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO landing_page (tenant_id, slug, title, headline, subheadline, body_markdown, cta_id, seo_title, seo_description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [tenantId, body.slug, body.title, body.headline, body.subheadline ?? null, body.bodyMarkdown ?? '',
       body.ctaId ?? null, body.seoTitle ?? null, body.seoDescription ?? null, principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A landing page with this slug already exists.' : message }, { status });
  }
}
