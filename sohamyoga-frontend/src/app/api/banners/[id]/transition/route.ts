import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { Banner, type BannerProps } from '@/domain/banner/Banner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'submit' | 'approve' | 'reject' | 'activate' | 'pause' | 'archive';

// POST — runs one of Banner.ts's real state-machine transitions (submit/
// approve/reject/activate/pause/archive) against a persisted row, reusing the
// domain class's own validation rather than duplicating it in SQL.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: Action; reason?: string } | null;
  if (!body?.action) return Response.json({ error: 'action is required.' }, { status: 400 });

  const result = await query(`SELECT * FROM banner WHERE id = $1`, [params.id]);
  if (!result.rows.length) return Response.json({ error: 'Banner not found.' }, { status: 404 });
  const r = result.rows[0] as Record<string, unknown>;

  const props: BannerProps = {
    id: r.id as string, title: r.title as string, slug: r.slug as string,
    type: r.type as BannerProps['type'], mediaType: r.media_type as BannerProps['mediaType'],
    mediaUrl: r.media_url as string, altText: r.alt_text as string,
    status: r.status as BannerProps['status'], tags: (r.tags as string[]) ?? [],
    isFeatured: r.is_featured as boolean, isFavorite: r.is_favorite as boolean,
    timezone: r.timezone as string, isRecurring: r.is_recurring as boolean,
    hasCountdown: r.has_countdown as boolean, hasGradientOverlay: r.has_gradient_overlay as boolean,
    isGlassCard: r.is_glass_card as boolean, sortOrder: r.sort_order as number,
    viewCount: r.view_count as number, clickCount: r.click_count as number, version: r.version as number,
    isPublished: r.is_published as boolean, notes: (r.notes as string) ?? '',
    createdBy: r.created_by as string, createdAt: new Date(r.created_at as string), updatedAt: new Date(r.updated_at as string),
    approvedBy: (r.approved_by as string) ?? undefined, pauseReason: (r.pause_reason as string) ?? undefined,
    rejectionReason: (r.rejection_reason as string) ?? undefined,
    scheduledStartAt: r.scheduled_start_at ? new Date(r.scheduled_start_at as string) : undefined,
    scheduledEndAt: r.scheduled_end_at ? new Date(r.scheduled_end_at as string) : undefined,
    publishedAt: r.published_at ? new Date(r.published_at as string) : undefined,
    archivedAt: r.archived_at ? new Date(r.archived_at as string) : undefined,
  };

  let updated: Banner;
  try {
    const banner = new Banner(props);
    switch (body.action) {
      case 'submit': updated = banner.submit(); break;
      case 'approve': updated = banner.approve(principal!.id); break;
      case 'reject': updated = banner.reject(body.reason ?? ''); break;
      case 'activate': updated = banner.activate(); break;
      case 'pause': updated = banner.pause(body.reason ?? ''); break;
      case 'archive': updated = banner.archive(); break;
      default: return Response.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Transition failed.' }, { status: 422 });
  }

  const p = updated.toJSON();
  await query(
    `UPDATE banner SET status = $2, version = $3, approved_by = $4, approved_at = $5, pause_reason = $6,
                        rejection_reason = $7, is_published = $8, published_at = $9, archived_at = $10, updated_at = $11
     WHERE id = $1`,
    [p.id, p.status, p.version, p.approvedBy ?? null, p.approvedAt ?? null, p.pauseReason ?? null,
     p.rejectionReason ?? null, p.isPublished, p.publishedAt ?? null, p.archivedAt ?? null, p.updatedAt],
  );

  return Response.json({ ok: true, status: p.status });
}
