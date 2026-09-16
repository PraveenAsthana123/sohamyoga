import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const action = url.searchParams.get('action');
  const assetId = url.searchParams.get('id');

  // Handle increment_download action via GET (query param pattern)
  if (action === 'increment_download' && assetId) {
    const result = await getPool().query(
      `UPDATE brand_assets SET download_count = download_count + 1 WHERE id = $1 RETURNING download_count`,
      [assetId]
    );
    if (!result.rowCount) return Response.json({ error: 'Asset not found.' }, { status: 404 });
    return Response.json({ ok: true, download_count: result.rows[0].download_count });
  }

  const pool = getPool();
  const assets = type
    ? await pool.query(`SELECT * FROM brand_assets WHERE asset_type = $1 ORDER BY is_primary DESC, created_at DESC`, [type])
    : await pool.query(`SELECT * FROM brand_assets ORDER BY is_primary DESC, asset_type, created_at DESC`);

  return Response.json({ assets: assets.rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const assetId = url.searchParams.get('id');

  // PATCH-like action via POST for increment
  if (action === 'increment_download' && assetId) {
    const result = await getPool().query(
      `UPDATE brand_assets SET download_count = download_count + 1 WHERE id = $1 RETURNING download_count`,
      [assetId]
    );
    if (!result.rowCount) return Response.json({ error: 'Asset not found.' }, { status: 404 });
    return Response.json({ ok: true, download_count: result.rows[0].download_count });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'name is required.' }, { status: 400 });
  }
  if (!body.asset_type) {
    return Response.json({ error: 'asset_type is required.' }, { status: 400 });
  }

  const result = await getPool().query(
    `INSERT INTO brand_assets
      (name, asset_type, file_url, thumbnail_url, format, dimensions,
       file_size_bytes, tags, usage_guidelines, version, is_primary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      body.name, body.asset_type, body.file_url || null, body.thumbnail_url || null,
      body.format || null, body.dimensions || null, body.file_size_bytes || null,
      body.tags || null, body.usage_guidelines || null, body.version || '1.0',
      body.is_primary ?? false,
    ]
  );

  return Response.json({ ok: true, asset: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const assetId = url.searchParams.get('id');

  if (action === 'increment_download' && assetId) {
    const result = await getPool().query(
      `UPDATE brand_assets SET download_count = download_count + 1 WHERE id = $1 RETURNING download_count`,
      [assetId]
    );
    if (!result.rowCount) return Response.json({ error: 'Asset not found.' }, { status: 404 });
    return Response.json({ ok: true, download_count: result.rows[0].download_count });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
