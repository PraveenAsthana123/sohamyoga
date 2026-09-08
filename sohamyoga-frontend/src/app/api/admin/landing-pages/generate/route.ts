import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { generateLandingPageDraft, slugify } from '@/domain/landingpage/LandingPageGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { brief?: string } | null;
  if (!body?.brief?.trim()) return Response.json({ error: 'brief is required.' }, { status: 400 });

  let draft;
  try {
    draft = await generateLandingPageDraft(body.brief);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed.' }, { status: 502 });
  }

  const tenantId = await getPrimaryTenantId();
  const baseSlug = slugify(draft.title);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await query(`SELECT 1 FROM landing_page WHERE tenant_id = $1 AND slug = $2`, [tenantId, slug]);
    if (!existing.rowCount) break;
    slug = `${baseSlug}-${attempt + 2}`;
  }

  const result = await query<{ id: string }>(
    `INSERT INTO landing_page (tenant_id, slug, title, headline, subheadline, body_markdown, seo_title, seo_description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [tenantId, slug, draft.title, draft.headline, draft.subheadline, draft.bodyMarkdown, draft.seoTitle, draft.seoDescription, principal!.id],
  );

  return Response.json({ ok: true, id: result.rows[0].id, slug, draft }, { status: 201 });
}
