// Shared load/save for VideoAsset, used by every route that needs the real
// domain object (not just the catalog listing in api/videos/route.ts, which
// reads its own flat projection). Centralizing this avoids re-deriving the
// row->props mapping at every call site.
import { query } from '@/lib/postgres';
import { VideoAsset, type VideoAssetProps } from './VideoAsset';

interface VideoAssetRow {
  id: string; slug: string; title: string; description: string; tags: string[];
  duration_seconds: number | null; thumbnail_url: string | null; source_url: string;
  status: VideoAssetProps['status']; view_count: number; social_variant_id: string | null;
  published_at: Date | null; created_by: string; created_at: Date; updated_at: Date;
  format: VideoAssetProps['format']; hashtags: string[];
  script: string | null; hook_lines: string[]; script_status: VideoAssetProps['scriptStatus'];
  script_generated_at: Date | null; script_approved_at: Date | null; script_approved_by: string | null;
  render_status: VideoAssetProps['renderStatus']; render_error: string | null;
  render_checksum_sha256: string | null; rendered_at: Date | null;
}

export async function loadVideoAsset(id: string): Promise<VideoAsset | null> {
  const rows = await query<VideoAssetRow>(
    `SELECT id, slug, title, description, tags, duration_seconds, thumbnail_url, source_url,
            status::text, view_count, social_variant_id, published_at, created_by, created_at, updated_at,
            format::text, hashtags, script, hook_lines, script_status::text,
            script_generated_at, script_approved_at, script_approved_by,
            render_status::text, render_error, render_checksum_sha256, rendered_at
     FROM video_asset WHERE id = $1`,
    [id],
  );
  if (!rows.rows.length) return null;
  const r = rows.rows[0];
  return new VideoAsset({
    id: r.id, slug: r.slug, title: r.title, description: r.description, tags: r.tags,
    durationSeconds: r.duration_seconds ?? undefined, thumbnailUrl: r.thumbnail_url ?? undefined,
    sourceUrl: r.source_url, status: r.status, viewCount: r.view_count,
    socialVariantId: r.social_variant_id ?? undefined, publishedAt: r.published_at ?? undefined,
    createdBy: r.created_by, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    format: r.format, hashtags: r.hashtags,
    script: r.script ?? undefined, hooks: r.hook_lines ?? [], scriptStatus: r.script_status,
    scriptGeneratedAt: r.script_generated_at ?? undefined,
    scriptApprovedAt: r.script_approved_at ?? undefined, scriptApprovedBy: r.script_approved_by ?? undefined,
    renderStatus: r.render_status, renderError: r.render_error ?? undefined,
    renderChecksum: r.render_checksum_sha256 ?? undefined, renderedAt: r.rendered_at ?? undefined,
  });
}

export async function saveVideoAssetState(video: VideoAsset): Promise<void> {
  const p = video.toJSON();
  await query(
    `UPDATE video_asset SET
       status = $2, published_at = $3,
       script = $4, hook_lines = $5, script_status = $6,
       script_generated_at = $7, script_approved_at = $8, script_approved_by = $9,
       render_status = $10, render_error = $11, render_checksum_sha256 = $12, rendered_at = $13,
       updated_at = now()
     WHERE id = $1`,
    [p.id, p.status, p.publishedAt ?? null,
      p.script ?? null, p.hooks, p.scriptStatus,
      p.scriptGeneratedAt ?? null, p.scriptApprovedAt ?? null, p.scriptApprovedBy ?? null,
      p.renderStatus, p.renderError ?? null, p.renderChecksum ?? null, p.renderedAt ?? null],
  );
}
