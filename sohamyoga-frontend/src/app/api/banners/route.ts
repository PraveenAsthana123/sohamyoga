import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { Banner, type BannerProps, type BannerCta } from '@/domain/banner/Banner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rowToProps(r: Record<string, unknown>): BannerProps {
  return {
    id: r.id as string, title: r.title as string, slug: r.slug as string,
    type: r.type as BannerProps['type'], mediaType: r.media_type as BannerProps['mediaType'],
    mediaUrl: r.media_url as string, thumbnailUrl: (r.thumbnail_url as string) ?? undefined,
    altText: r.alt_text as string, overlayText: (r.overlay_text as string) ?? undefined,
    headline: (r.headline as string) ?? undefined, subheadline: (r.subheadline as string) ?? undefined,
    cta: r.cta_label ? { label: r.cta_label as string, url: r.cta_url as string, style: r.cta_style as BannerCta['style'], trackingId: (r.cta_tracking_id as string) ?? undefined } : undefined,
    status: r.status as BannerProps['status'], categoryId: (r.category_id as string) ?? undefined,
    categoryName: (r.category_name as string) ?? undefined, tags: (r.tags as string[]) ?? [],
    isFeatured: r.is_featured as boolean, isFavorite: r.is_favorite as boolean,
    scheduledStartAt: r.scheduled_start_at ? new Date(r.scheduled_start_at as string) : undefined,
    scheduledEndAt: r.scheduled_end_at ? new Date(r.scheduled_end_at as string) : undefined,
    timezone: r.timezone as string, isRecurring: r.is_recurring as boolean,
    personalization: (r.personalization as BannerProps['personalization']) ?? undefined,
    autoRotateSeconds: (r.auto_rotate_seconds as number) ?? undefined,
    hasCountdown: r.has_countdown as boolean, countdownEndAt: r.countdown_end_at ? new Date(r.countdown_end_at as string) : undefined,
    hasGradientOverlay: r.has_gradient_overlay as boolean, gradientColor: (r.gradient_color as string) ?? undefined,
    isGlassCard: r.is_glass_card as boolean, sortOrder: r.sort_order as number,
    viewCount: r.view_count as number, clickCount: r.click_count as number, version: r.version as number,
    approvedBy: (r.approved_by as string) ?? undefined, approvedAt: r.approved_at ? new Date(r.approved_at as string) : undefined,
    pauseReason: (r.pause_reason as string) ?? undefined, rejectionReason: (r.rejection_reason as string) ?? undefined,
    isPublished: r.is_published as boolean, publishedAt: r.published_at ? new Date(r.published_at as string) : undefined,
    archivedAt: r.archived_at ? new Date(r.archived_at as string) : undefined, notes: (r.notes as string) ?? '',
    createdBy: r.created_by as string, createdAt: new Date(r.created_at as string), updatedAt: new Date(r.updated_at as string),
  };
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(`SELECT * FROM banner WHERE tenant_id = $1 ORDER BY sort_order, created_at DESC`, [tenantId]);

  const banners = rows.rows.map(r => new Banner(rowToProps(r)).toJSON());
  return Response.json({
    banners: banners.map(b => ({
      id: b.id, title: b.title, type: b.type, mediaType: b.mediaType, status: b.status,
      category: b.categoryName ?? '—', tags: b.tags, views: b.viewCount, clicks: b.clickCount,
      isFeatured: b.isFeatured, isFavorite: b.isFavorite,
      schedule: b.scheduledStartAt && b.scheduledEndAt
        ? `${new Date(b.scheduledStartAt).toLocaleDateString()}–${new Date(b.scheduledEndAt).toLocaleDateString()}`
        : '—',
    })),
  });
}

// POST — creates a new draft banner. Real validation runs through the Banner
// domain class's constructor (throws on invalid slug/title/altText/etc).
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string; slug?: string; type?: string; mediaType?: string; mediaUrl?: string; altText?: string;
  } | null;
  if (!body?.title || !body.slug || !body.type || !body.mediaType || !body.mediaUrl || !body.altText) {
    return Response.json({ error: 'title, slug, type, mediaType, mediaUrl, and altText are all required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();

  let banner: Banner;
  try {
    banner = new Banner({
      id: crypto.randomUUID(), title: body.title, slug: body.slug,
      type: body.type as BannerProps['type'], mediaType: body.mediaType as BannerProps['mediaType'],
      mediaUrl: body.mediaUrl, altText: body.altText, status: 'draft', tags: [],
      isFeatured: false, isFavorite: false, timezone: 'UTC', isRecurring: false,
      hasCountdown: false, hasGradientOverlay: false, isGlassCard: false, sortOrder: 0,
      viewCount: 0, clickCount: 0, version: 1, isPublished: false, notes: '',
      createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid banner data.' }, { status: 400 });
  }

  const p = banner.toJSON();
  try {
    await query(
      `INSERT INTO banner (id, tenant_id, title, slug, type, media_type, media_url, alt_text, status, tags,
                            is_featured, is_favorite, timezone, is_recurring, has_countdown, has_gradient_overlay,
                            is_glass_card, sort_order, view_count, click_count, version, is_published, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [p.id, tenantId, p.title, p.slug, p.type, p.mediaType, p.mediaUrl, p.altText, p.status, p.tags,
       p.isFeatured, p.isFavorite, p.timezone, p.isRecurring, p.hasCountdown, p.hasGradientOverlay,
       p.isGlassCard, p.sortOrder, p.viewCount, p.clickCount, p.version, p.isPublished, p.notes, p.createdBy],
    );
    return Response.json({ ok: true, id: p.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A banner with this slug already exists.' : message }, { status });
  }
}
