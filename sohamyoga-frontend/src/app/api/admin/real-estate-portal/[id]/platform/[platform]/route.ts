import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending', 'submitted', 'active', 'expired', 'rejected'];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; platform: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id, platform } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return Response.json({ error: 'Invalid listing ID.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const {
    status, platform_url, platform_listing_id,
    views_count, saves_count, inquiries_count,
    submitted_at, goes_live_at, expires_at, notes,
  } = body as Record<string, unknown>;

  if (status && !VALID_STATUSES.includes(status as string)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Upsert: if row doesn't exist yet, create it
    const upsertRes = await client.query(
      `INSERT INTO real_estate_platform (listing_id, platform, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (listing_id, platform) DO NOTHING
       RETURNING id`,
      [listingId, platform]
    );

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(status); }
    if (platform_url !== undefined) { setClauses.push(`platform_url = $${idx++}`); values.push(platform_url); }
    if (platform_listing_id !== undefined) { setClauses.push(`platform_listing_id = $${idx++}`); values.push(platform_listing_id); }
    if (views_count !== undefined) { setClauses.push(`views_count = $${idx++}`); values.push(Number(views_count)); }
    if (saves_count !== undefined) { setClauses.push(`saves_count = $${idx++}`); values.push(Number(saves_count)); }
    if (inquiries_count !== undefined) { setClauses.push(`inquiries_count = $${idx++}`); values.push(Number(inquiries_count)); }
    if (submitted_at !== undefined) { setClauses.push(`submitted_at = $${idx++}`); values.push(submitted_at); }
    if (goes_live_at !== undefined) { setClauses.push(`goes_live_at = $${idx++}`); values.push(goes_live_at); }
    if (expires_at !== undefined) { setClauses.push(`expires_at = $${idx++}`); values.push(expires_at); }
    if (notes !== undefined) { setClauses.push(`notes = $${idx++}`); values.push(notes); }

    if (!setClauses.length && !upsertRes.rows.length) {
      // Row already existed, just return it
      const existing = await client.query(
        `SELECT * FROM real_estate_platform WHERE listing_id = $1 AND platform = $2`,
        [listingId, platform]
      );
      return Response.json({ platform: existing.rows[0] || null });
    }

    if (setClauses.length) {
      values.push(listingId, platform);
      const res = await client.query(
        `UPDATE real_estate_platform SET ${setClauses.join(', ')}
         WHERE listing_id = $${idx} AND platform = $${idx + 1}
         RETURNING *`,
        values
      );
      if (!res.rows.length) return Response.json({ error: 'Platform row not found.' }, { status: 404 });
      return Response.json({ platform: res.rows[0] });
    }

    const existing = await client.query(
      `SELECT * FROM real_estate_platform WHERE listing_id = $1 AND platform = $2`,
      [listingId, platform]
    );
    return Response.json({ platform: existing.rows[0] || null });
  } finally {
    client.release();
  }
}
