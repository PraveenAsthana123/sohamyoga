import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const asset_type = searchParams.get('asset_type');
  const ad_message_type = searchParams.get('ad_message_type');
  const limit = parseInt(searchParams.get('limit') || '50');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (asset_type) { conditions.push(`asset_type = $${idx++}`); values.push(asset_type); }
  if (ad_message_type) { conditions.push(`ad_message_type = $${idx++}`); values.push(ad_message_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(`
    SELECT * FROM ad_visual_asset ${where} ORDER BY created_at DESC LIMIT $${idx}
  `, [...values, limit]);

  return Response.json({ assets: result.rows });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { name, url, asset_type, ad_message_type, platform, width_px, height_px, file_size_kb, tags } = body;

  if (!name || !url) return Response.json({ error: 'name and url required' }, { status: 400 });

  const result = await query<{ id: string }>(`
    INSERT INTO ad_visual_asset (name, url, asset_type, ad_message_type, platform, width_px, height_px, file_size_kb, tags)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id
  `, [name, url, asset_type || 'image', ad_message_type || null, platform || [], width_px || null, height_px || null, file_size_kb || null, tags || []]);

  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
