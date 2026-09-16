import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const listRes = await client.query(`
      SELECT l.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'platform', p.platform,
              'status', p.status,
              'platform_url', p.platform_url,
              'platform_ad_id', p.platform_ad_id,
              'posted_at', p.posted_at,
              'expires_at', p.expires_at,
              'views_count', p.views_count,
              'responses_count', p.responses_count,
              'notes', p.notes
            ) ORDER BY p.platform
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS platform_statuses
      FROM calgary_listing l
      LEFT JOIN calgary_listing_platform p ON p.listing_id = l.id
      WHERE l.id = $1
      GROUP BY l.id
    `, [id]);

    if (!listRes.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ listing: listRes.rows[0] });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });

  const allowed = ['title','category','subcategory','price','price_type','description',
    'location','neighbourhood','images','contact_name','contact_email','contact_phone','tags','status'];
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { sets.push(`${key} = $${idx++}`); values.push((body as Record<string, unknown>)[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields.' }, { status: 400 });
  sets.push(`updated_at = NOW()`);
  values.push(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE calgary_listing SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!res.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ listing: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE calgary_listing SET status='expired', updated_at=NOW() WHERE id=$1 RETURNING id`,
      [id]
    );
    if (!res.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
