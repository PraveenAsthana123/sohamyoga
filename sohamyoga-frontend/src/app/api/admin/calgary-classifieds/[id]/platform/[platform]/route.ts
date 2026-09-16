import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPIRY_DAYS: Record<string, number> = {
  craigslist: 7,
  realtor_ca: 90,
  autotrader: 90,
  zumper: 60,
};
const DEFAULT_EXPIRY_DAYS = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; platform: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id, platform } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });

  const { status, platform_url, platform_ad_id, views_count, responses_count, notes } = body as Record<string, unknown>;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Check current status to detect transition to 'posted'
    const current = await client.query(
      `SELECT status FROM calgary_listing_platform WHERE listing_id=$1 AND platform=$2`,
      [id, platform]
    );
    if (!current.rowCount) return Response.json({ error: 'Platform row not found.' }, { status: 404 });

    const wasPosted = current.rows[0].status === 'posted';
    const nowPosted = status === 'posted';
    const setPostedAt = nowPosted && !wasPosted;

    const expiryDays = EXPIRY_DAYS[platform] ?? DEFAULT_EXPIRY_DAYS;

    const res = await client.query(`
      UPDATE calgary_listing_platform SET
        status = COALESCE($3, status),
        platform_url = COALESCE($4, platform_url),
        platform_ad_id = COALESCE($5, platform_ad_id),
        views_count = COALESCE($6, views_count),
        responses_count = COALESCE($7, responses_count),
        notes = COALESCE($8, notes),
        posted_at = CASE WHEN $9 THEN NOW() ELSE posted_at END,
        expires_at = CASE WHEN $9 THEN NOW() + INTERVAL '1 day' * $10 ELSE expires_at END
      WHERE listing_id=$1 AND platform=$2
      RETURNING *
    `, [id, platform, status ?? null, platform_url ?? null, platform_ad_id ?? null,
        views_count ?? null, responses_count ?? null, notes ?? null,
        setPostedAt, expiryDays]);

    if (!res.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ platform_status: res.rows[0] });
  } finally {
    client.release();
  }
}
