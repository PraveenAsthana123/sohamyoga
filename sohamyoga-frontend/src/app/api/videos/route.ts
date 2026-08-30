import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { VideoAsset } from '@/domain/video/VideoAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT v.id, v.slug, v.title, v.tags, v.duration_seconds, v.thumbnail_url, v.source_url,
            v.status::text, v.view_count, v.published_at, v.created_at, v.format::text, v.hashtags,
            v.script, v.hook_lines, v.script_status::text, v.render_status::text, v.render_error,
            v.render_duration_seconds, v.rendered_at,
            spv.platform_post_id AS youtube_post_id, spv.status AS youtube_publish_status
     FROM video_asset v
     LEFT JOIN social_platform_variant spv ON spv.id = v.social_variant_id
     WHERE v.tenant_id = $1 ORDER BY v.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    videos: rows.rows.map(r => ({
      id: r.id, slug: r.slug, title: r.title, tags: r.tags, durationSeconds: r.duration_seconds,
      thumbnailUrl: r.thumbnail_url, sourceUrl: r.source_url, status: r.status, viewCount: r.view_count,
      publishedAt: r.published_at, createdAt: r.created_at, format: r.format, hashtags: r.hashtags,
      script: r.script ?? null, hookLines: r.hook_lines ?? [], scriptStatus: r.script_status,
      renderStatus: r.render_status, renderError: r.render_error ?? null,
      renderDurationSeconds: r.render_duration_seconds ?? null, renderedAt: r.rendered_at ?? null,
      youtubePostId: r.youtube_post_id ?? null, youtubePublishStatus: r.youtube_publish_status ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    slug?: string; title?: string; description?: string; tags?: string[];
    durationSeconds?: number; thumbnailUrl?: string; sourceUrl?: string;
    format?: 'long_form' | 'reel'; hashtags?: string[];
  } | null;
  if (!body?.slug || !body.title || !body.sourceUrl) {
    return Response.json({ error: 'slug, title, and sourceUrl are required.' }, { status: 400 });
  }
  const format = body.format === 'reel' ? 'reel' : 'long_form';

  try {
    new VideoAsset({
      id: '00000000-0000-0000-0000-000000000000', slug: body.slug, title: body.title,
      description: body.description ?? '', tags: body.tags ?? [], durationSeconds: body.durationSeconds,
      thumbnailUrl: body.thumbnailUrl, sourceUrl: body.sourceUrl, status: 'draft', viewCount: 0,
      createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
      format, hashtags: body.hashtags ?? [],
      hooks: [], scriptStatus: 'none', renderStatus: 'none',
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid video data.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO video_asset (tenant_id, slug, title, description, tags, duration_seconds, thumbnail_url, source_url, created_by, format, hashtags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [tenantId, body.slug, body.title, body.description ?? '', body.tags ?? [], body.durationSeconds ?? null,
        body.thumbnailUrl ?? null, body.sourceUrl, principal!.id, format, body.hashtags ?? []],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A video with this slug already exists.' : message }, { status });
  }
}
