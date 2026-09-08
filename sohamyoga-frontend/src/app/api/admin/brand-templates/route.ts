import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEMPLATE_TYPES = ['social_post', 'email', 'ad_copy', 'sms'];

// Real Brand Template Management -- first build. No reusable-content-template
// concept existed anywhere in the codebase (confirmed via grep for
// brand_template/BrandTemplate/content_template, zero hits before this).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, brand_kit_id, name, template_type, platform, body_template, usage_count, created_by, updated_at
     FROM brand_template WHERE tenant_id = $1 ORDER BY updated_at DESC`,
    [tenantId],
  );
  return Response.json({ templates: rows.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    brandKitId?: string | null; name?: string; templateType?: string; platform?: string | null; bodyTemplate?: string;
  } | null;
  if (!body?.name?.trim() || !TEMPLATE_TYPES.includes(body.templateType ?? '') || !body.bodyTemplate?.trim()) {
    return Response.json({ error: `name, a valid templateType (${TEMPLATE_TYPES.join('|')}), and bodyTemplate are required.` }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO brand_template (tenant_id, brand_kit_id, name, template_type, platform, body_template, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, brand_kit_id, name, template_type, platform, body_template, usage_count, created_by, updated_at`,
    [tenantId, body.brandKitId || null, body.name.trim(), body.templateType, body.platform || null, body.bodyTemplate.trim(), principal!.email ?? principal!.id],
  );
  return Response.json({ template: result.rows[0] }, { status: 201 });
}
