import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSET_TYPE_TO_CONTENT_TYPE: Record<string, string> = {
  image: 'image', video: 'video', copy_text: 'text',
};

// POST — "Use in new post": pre-fills a real social_content_draft row (the
// real existing drafting flow in src/domain/social, same table the
// create_content_draft MCP tool and YogaEducationContentJob write to) with
// this library asset's content. Makes the library a genuine feeder into the
// real existing publishing pipeline rather than a disconnected duplicate.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const asset = await query<{ id: string; tenant_id: string; title: string; asset_type: string; file_url: string | null; body_text: string | null; tags: string[] }>(
    `SELECT id, tenant_id, title, asset_type::text, file_url, body_text, tags FROM content_asset WHERE id = $1`,
    [params.id],
  );
  if (!asset.rows.length) return Response.json({ error: 'Content asset not found.' }, { status: 404 });
  const a = asset.rows[0];

  const masterText = a.asset_type === 'copy_text' ? (a.body_text ?? '') : a.title;
  const masterMediaUrls = a.file_url ? [a.file_url] : [];
  const contentType = ASSET_TYPE_TO_CONTENT_TYPE[a.asset_type] ?? 'text';

  const result = await query<{ id: string }>(
    `INSERT INTO social_content_draft (tenant_id, workspace_id, master_text, content_type, master_media_urls, generated_with_ai, tags, created_by)
     VALUES ($1,$1,$2,$3,$4,false,$5,$6) RETURNING id`,
    [a.tenant_id, masterText, contentType, masterMediaUrls, a.tags, principal!.id],
  );
  return Response.json({ ok: true, draftId: result.rows[0].id }, { status: 201 });
}
