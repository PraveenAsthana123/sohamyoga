import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; platform: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id, platform } = await params;
  const body = await req.json() as Record<string, unknown>;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Upsert the platform row
    const res = await client.query(
      `INSERT INTO rental_platform (listing_id, platform, status, platform_url, platform_listing_id,
         posted_at, expires_at, views_count, inquiries_count, monthly_cost, notes)
       VALUES ($1, $2,
         COALESCE($3, 'pending'), $4, $5,
         $6, $7,
         COALESCE($8, 0), COALESCE($9, 0),
         COALESCE($10, 0), $11)
       ON CONFLICT (listing_id, platform) DO UPDATE SET
         status              = COALESCE(EXCLUDED.status, rental_platform.status),
         platform_url        = COALESCE(EXCLUDED.platform_url, rental_platform.platform_url),
         platform_listing_id = COALESCE(EXCLUDED.platform_listing_id, rental_platform.platform_listing_id),
         posted_at           = COALESCE(EXCLUDED.posted_at, rental_platform.posted_at),
         expires_at          = COALESCE(EXCLUDED.expires_at, rental_platform.expires_at),
         views_count         = COALESCE(EXCLUDED.views_count, rental_platform.views_count),
         inquiries_count     = COALESCE(EXCLUDED.inquiries_count, rental_platform.inquiries_count),
         monthly_cost        = COALESCE(EXCLUDED.monthly_cost, rental_platform.monthly_cost),
         notes               = COALESCE(EXCLUDED.notes, rental_platform.notes)
       RETURNING *`,
      [
        id, platform,
        body.status ?? null,
        body.platform_url ?? null,
        body.platform_listing_id ?? null,
        body.posted_at ?? null,
        body.expires_at ?? null,
        body.views_count ?? null,
        body.inquiries_count ?? null,
        body.monthly_cost ?? null,
        body.notes ?? null,
      ],
    );

    return Response.json({ platform: res.rows[0] });
  } finally {
    client.release();
  }
}
