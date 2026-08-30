import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { ContentAsset, type ContentAssetType } from '@/domain/social/ContentAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const search = req.nextUrl.searchParams.get('q')?.trim();
  const category = req.nextUrl.searchParams.get('category')?.trim();

  const conditions = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  if (search) { params.push(`%${search}%`); conditions.push(`(title ILIKE $${params.length} OR $${params.length} = ANY(tags))`); }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }

  const rows = await query(
    `SELECT id, title, asset_type::text, file_url, body_text, tags, category, created_at
     FROM content_asset WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
  return Response.json({ assets: rows.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string; assetType?: ContentAssetType; fileUrl?: string; bodyText?: string;
    tags?: string[]; category?: string;
  } | null;
  if (!body?.title || !body.assetType) {
    return Response.json({ error: 'title and assetType are required.' }, { status: 400 });
  }

  try {
    new ContentAsset({
      id: '00000000-0000-0000-0000-000000000000', title: body.title, assetType: body.assetType,
      fileUrl: body.fileUrl, bodyText: body.bodyText, tags: body.tags ?? [], category: body.category,
      createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid content asset data.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO content_asset (tenant_id, title, asset_type, file_url, body_text, tags, category, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [tenantId, body.title, body.assetType, body.fileUrl ?? null, body.bodyText ?? null, body.tags ?? [], body.category ?? null, principal!.id],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
