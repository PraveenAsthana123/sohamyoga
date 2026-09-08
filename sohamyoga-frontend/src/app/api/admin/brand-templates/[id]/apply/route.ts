import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Applying a brand template creates a real content_variant draft -- this is
// what makes the template library a wired feature rather than an orphaned
// CRUD screen with nothing downstream consuming it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { briefId?: string; platform?: string };

  const tpl = await query<{ template_type: string; platform: string | null; body_template: string }>(
    `SELECT template_type, platform, body_template FROM brand_template WHERE id = $1`, [id],
  );
  if (!tpl.rowCount) return Response.json({ error: 'Template not found.' }, { status: 404 });
  const t = tpl.rows[0];

  const platform = body.platform || t.platform;
  if (!platform) return Response.json({ error: 'platform is required (this template has no default platform).' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO content_variant (tenant_id, brief_id, platform, master_content, adapted_content, status)
     VALUES ($1,$2,$3,$4,$4,'draft') RETURNING id`,
    [tenantId, body.briefId || null, platform, t.body_template],
  );
  await query(`UPDATE brand_template SET usage_count = usage_count + 1 WHERE id = $1`, [id]);

  return Response.json({ ok: true, contentVariantId: result.rows[0].id }, { status: 201 });
}
