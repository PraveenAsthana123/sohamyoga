import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSET_TYPES = ['logo', 'photo', 'banner', 'icon', 'video', 'document', 'other'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query(
    `SELECT id, name, asset_type, url, notes, uploaded_by, created_at FROM brand_asset WHERE brand_kit_id = $1 ORDER BY created_at DESC`,
    [id],
  );
  return Response.json({
    assets: result.rows.map((r) => ({
      id: r.id, name: r.name, assetType: r.asset_type, url: r.url, notes: r.notes, uploadedBy: r.uploaded_by, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { name?: string; assetType?: string; url?: string; notes?: string } | null;
  if (!body?.name?.trim() || !body.url?.trim()) return Response.json({ error: 'name and url are required.' }, { status: 400 });
  if (!ASSET_TYPES.includes(body.assetType ?? '')) {
    return Response.json({ error: `assetType must be one of: ${ASSET_TYPES.join(', ')}` }, { status: 400 });
  }

  const kit = await query('SELECT id FROM brand_kit WHERE id = $1', [id]);
  if (!kit.rowCount) return Response.json({ error: 'Brand kit not found.' }, { status: 404 });

  const result = await query<{ id: string }>(
    `INSERT INTO brand_asset (brand_kit_id, name, asset_type, url, notes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [id, body.name.trim(), body.assetType, body.url.trim(), body.notes ?? '', principal?.email ?? 'admin'],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
